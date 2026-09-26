import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { getCurrentUser, readJson, writeJson } from '../utils/storage.js';
import { cleanText, firstError, validateDateOrder, validateImageFile, validatePhone, validateRequired } from '../utils/validation.js';

function profileKey(email) {
  return `kb-member-profile-${String(email || 'guest').toLowerCase()}`;
}

function childrenKey(email) {
  return `kb-member-children-${String(email || 'guest').toLowerCase()}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || file.size === 0) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;

  const [profile, setProfile] = useState(() => readJson(profileKey(user.email), {}));
  const [children, setChildren] = useState(() => readJson(childrenKey(user.email), []));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [childError, setChildError] = useState('');

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setError('');
    setSaved(false);

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const photoFile = form.elements.profilePhoto?.files?.[0];
    const imageError = validateImageFile(photoFile);
    const validationError = firstError([
      validateRequired(payload.firstName, 'First name'),
      validateRequired(payload.lastName, 'Last name'),
      validateRequired(payload.birthDate, 'Date of birth'),
      validatePhone(payload.phone),
      validateRequired(payload.gender, 'Gender'),
      validateRequired(payload.company, 'Company'),
      validateDateOrder(payload.birthDate, payload.spouseBirthDate, 'Spouse date of birth cannot be before member date of birth.'),
      imageError
    ]);

    if (validationError) {
      setError(validationError);
      return;
    }

    const photo = await fileToDataUrl(photoFile);
    const nextProfile = {
      ...profile,
      firstName: cleanText(payload.firstName),
      lastName: cleanText(payload.lastName),
      birthDate: payload.birthDate,
      phone: cleanText(payload.phone),
      gender: payload.gender,
      company: cleanText(payload.company),
      description: cleanText(payload.description),
      address1: cleanText(payload.address1),
      address2: cleanText(payload.address2),
      city: cleanText(payload.city),
      state: cleanText(payload.state),
      zipCode: cleanText(payload.zipCode),
      spouseFirstName: cleanText(payload.spouseFirstName),
      spouseLastName: cleanText(payload.spouseLastName),
      spouseBirthDate: payload.spouseBirthDate,
      photo: photo || profile.photo || '',
      updatedAt: new Date().toISOString()
    };

    writeJson(profileKey(user.email), nextProfile);
    setProfile(nextProfile);
    setSaved(true);
    window.dispatchEvent(new Event('kb-data-change'));
  }

  function handleChildSubmit(event) {
    event.preventDefault();
    setChildError('');
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const validationError = firstError([
      validateRequired(payload.firstName, 'Child first name'),
      validateRequired(payload.lastName, 'Child last name'),
      validateRequired(payload.gender, 'Child gender'),
      validateRequired(payload.birthDate, 'Child date of birth')
    ]);

    if (validationError) {
      setChildError(validationError);
      return;
    }

    const nextChildren = [
      ...children,
      {
        id: `child-${Date.now()}`,
        firstName: cleanText(payload.firstName),
        lastName: cleanText(payload.lastName),
        gender: payload.gender,
        birthDate: payload.birthDate
      }
    ];
    writeJson(childrenKey(user.email), nextChildren);
    setChildren(nextChildren);
    form.reset();
    window.dispatchEvent(new Event('kb-data-change'));
  }

  function removeChild(id) {
    const nextChildren = children.filter((child) => child.id !== id);
    writeJson(childrenKey(user.email), nextChildren);
    setChildren(nextChildren);
    window.dispatchEvent(new Event('kb-data-change'));
  }

  return (
    <main className="member-profile-page">
      <section className="member-profile-shell">
        <aside className="member-account-card">
          <div className="member-avatar">
            {profile.photo ? <img src={profile.photo} alt="Profile" /> : <Camera size={34} />}
          </div>
          <h1>Manage your account</h1>
          <p>{user.email}</p>
          <div className="member-account-lines">
            <span><strong>Password</strong><em>Create</em></span>
            <span><strong>External logins</strong><em>Manage</em></span>
          </div>
        </aside>

        <section className="member-profile-content">
          <form className="member-profile-form" onSubmit={handleProfileSubmit}>
            <h2>Profile information</h2>
            <p className="profile-helper">Update your member details. Required fields are marked with *.</p>
            <label className="profile-photo-field">
              Profile picture <small>(jpg/jpeg/png)</small>
              <input name="profilePhoto" type="file" accept="image/png,image/jpeg" />
            </label>
            <div className="form-two">
              <label>First name *<input name="firstName" defaultValue={profile.firstName || user.firstName || user.name?.split(' ')[0] || ''} required /></label>
              <label>Last name *<input name="lastName" defaultValue={profile.lastName || user.lastName || user.name?.split(' ').slice(1).join(' ') || ''} required /></label>
            </div>
            <div className="form-two">
              <label>Date of birth *<input name="birthDate" type="date" defaultValue={profile.birthDate || ''} required /></label>
              <label>Phone number *<input name="phone" type="tel" defaultValue={profile.phone || user.phone || ''} required /></label>
            </div>
            <div className="form-two">
              <label>Gender *<select name="gender" defaultValue={profile.gender || 'Male'} required><option>Male</option><option>Female</option><option>Prefer not to say</option></select></label>
              <label>Company * <small>(NA if not applicable)</small><input name="company" defaultValue={profile.company || 'NA'} required /></label>
            </div>
            <label>Description<textarea name="description" defaultValue={profile.description || ''} maxLength="500" /></label>

            <h3>Address</h3>
            <div className="form-two">
              <label>Address line1<input name="address1" defaultValue={profile.address1 || ''} /></label>
              <label>Address line2<input name="address2" defaultValue={profile.address2 || ''} /></label>
            </div>
            <div className="form-three">
              <label>City<input name="city" defaultValue={profile.city || ''} /></label>
              <label>State<input name="state" defaultValue={profile.state || ''} /></label>
              <label>Zip code<input name="zipCode" defaultValue={profile.zipCode || ''} /></label>
            </div>

            <h3>Spouse info</h3>
            <div className="form-two">
              <label>First name<input name="spouseFirstName" defaultValue={profile.spouseFirstName || ''} /></label>
              <label>Last name<input name="spouseLastName" defaultValue={profile.spouseLastName || ''} /></label>
            </div>
            <label>Date of birth<input name="spouseBirthDate" type="date" defaultValue={profile.spouseBirthDate || ''} /></label>

            {error && <p className="form-error">{error}</p>}
            {saved && <p className="success">Profile saved.</p>}
            <button className="button primary" type="submit">Save Profile</button>
          </form>

          <section className="member-profile-form">
            <h2>Children info</h2>
            <form className="child-inline-form" onSubmit={handleChildSubmit}>
              <input name="firstName" placeholder="First name" />
              <input name="lastName" placeholder="Last name" />
              <select name="gender" defaultValue="">
                <option value="" disabled>Gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Prefer not to say</option>
              </select>
              <input name="birthDate" type="date" />
              <button className="button compact" type="submit"><Plus size={16} /> Add child</button>
            </form>
            {childError && <p className="form-error">{childError}</p>}
            <div className="table-scroll">
              <table>
                <thead><tr><th>First name</th><th>Last name</th><th>Gender</th><th>Date of birth</th><th>Action</th></tr></thead>
                <tbody>
                  {children.length ? children.map((child) => (
                    <tr key={child.id}>
                      <td>{child.firstName}</td><td>{child.lastName}</td><td>{child.gender}</td><td>{child.birthDate}</td>
                      <td><button className="table-icon-button" type="button" onClick={() => removeChild(child.id)}><Trash2 size={15} /> Remove</button></td>
                    </tr>
                  )) : <tr><td colSpan="5">No children added yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
