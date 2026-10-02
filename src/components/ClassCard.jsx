import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, MapPin, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';
import { getCurrentUser, readJson, writeJson } from '../utils/storage.js';
import { apiAppendRecord } from '../utils/api.js';
import { cleanText, firstError, validateEmail, validatePhone, validateRequired } from '../utils/validation.js';

function getClassImage(item) {
  if (item.photo) return item.photo;

  const title = item.title.toLowerCase();
  if (title.includes('guitar')) return '/assets/classes/guitar-class-photo.png';
  if (title.includes('sandalwood')) return '/assets/classes/sandalwood-dance-photo.png';
  if (title.includes('bharatanatya')) return '/assets/culture-feature/classical-dance-feature.png';
  if (title.includes('hindustani')) return '/assets/culture-feature/music-traditions-feature.png';
  if (title.includes('carnatic')) return '/assets/culture-feature/music-traditions-feature.png';
  if ((item.category || '').toLowerCase() === 'music') return '/assets/culture-feature/music-traditions-feature.png';
  if ((item.category || '').toLowerCase() === 'dance') return '/assets/culture-feature/classical-dance-feature.png';
  return '/assets/classes/kannada-language-class.png';
}

function getFeeText(item) {
  const value = item.fee ?? item.registrationFee ?? item.price ?? item.donationAmount;
  if (value === null || value === undefined || value === '') return 'the listed donation/fee';
  if (typeof value === 'number') return `$${value}`;
  return String(value);
}

function getFeeAmount(item) {
  const value = item.fee ?? item.registrationFee ?? item.price ?? item.donationAmount;
  const parsed = Number(String(value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function fullName(...parts) {
  return parts.map((part) => String(part || '').trim()).filter(Boolean).join(' ');
}

function getBirthYear(value) {
  if (!value) return '';
  const year = new Date(value).getFullYear();
  return Number.isFinite(year) ? String(year) : '';
}

function buildMemberOptions(user) {
  if (!user?.email) return [];

  const email = String(user.email).toLowerCase();
  const profile = readJson(`kb-member-profile-${email}`, {});
  const children = readJson(`kb-member-children-${email}`, []);
  const selfName = fullName(profile.firstName, profile.lastName)
    || fullName(user.firstName, user.lastName)
    || user.name
    || user.email;
  const spouseName = fullName(profile.spouseFirstName, profile.spouseLastName);
  const members = [{
    value: `self:${selfName}`,
    label: `${selfName} (self)`,
    name: selfName,
    relation: 'Self',
    birthYear: getBirthYear(profile.birthDate || user.birthDate)
  }];

  if (spouseName) {
    members.push({
      value: `spouse:${spouseName}`,
      label: `${spouseName} (spouse)`,
      name: spouseName,
      relation: 'Spouse',
      birthYear: getBirthYear(profile.spouseBirthDate)
    });
  }

  children.forEach((child, index) => {
    const childName = fullName(child.firstName || child.childFirstName, child.lastName || child.childLastName) || `Child ${index + 1}`;
    members.push({
      value: `child-${index}:${childName}`,
      label: `${childName} (child)`,
      name: childName,
      relation: 'Child',
      birthYear: getBirthYear(child.birthDate || child.childBirthDate)
    });
  });

  return members;
}

export default function ClassCard({ item, registerSignal = 0 }) {
  const { tr } = useLanguage();
  const [showDetails, setShowDetails] = useState(false);
  const [showMemberRegister, setShowMemberRegister] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');
  const [memberSaved, setMemberSaved] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestError, setGuestError] = useState('');
  const [guestSaved, setGuestSaved] = useState(false);
  const [registrationNotice, setRegistrationNotice] = useState(null);
  const classImage = getClassImage(item);
  const registerUrl = `/register?program=${encodeURIComponent(item.title)}`;
  const feeText = getFeeText(item);
  const feeAmount = getFeeAmount(item);
  const user = getCurrentUser();
  const memberOptions = buildMemberOptions(user);

  function openMemberRegistration() {
    setShowDetails(true);
    setShowGuestForm(false);
    setShowMemberRegister(true);
    setSelectedMember(memberOptions[0]?.value || '');
    setMemberError('');
    setMemberSaved(false);
  }

  useEffect(() => {
    if (registerSignal > 0) openMemberRegistration();
  }, [registerSignal]);

  async function saveRegistration(record) {
    try {
      const saved = await apiAppendRecord('kb-registration-submissions', record);
      const existing = readJson('kb-registration-submissions', []);
      writeJson('kb-registration-submissions', [...existing, saved || { ...record, createdAt: new Date().toISOString() }]);
      window.dispatchEvent(new Event('kb-data-change'));
      return saved || record;
    } catch (error) {
      if (/already registered/i.test(error.message || '')) throw error;
      const existing = readJson('kb-registration-submissions', []);
      writeJson('kb-registration-submissions', [...existing, { ...record, createdAt: new Date().toISOString() }]);
      window.dispatchEvent(new Event('kb-data-change'));
      error.localSaved = true;
      throw error;
    }
  }

  async function handleGuestSubmit(event) {
    event.preventDefault();
    setGuestError('');
    setGuestSaved(false);

    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const firstName = cleanText(payload.firstName);
    const lastName = cleanText(payload.lastName);
    const email = cleanText(payload.email).toLowerCase();
    const phone = cleanText(payload.phone);
    const validationError = firstError([
      validateRequired(firstName, 'First name'),
      validateRequired(lastName, 'Last name'),
      validateEmail(email),
      validatePhone(phone)
    ]);

    if (validationError) {
      setGuestError(validationError);
      return;
    }

    const record = {
      parentName: `${firstName} ${lastName}`.trim(),
      studentName: cleanText(payload.studentName) || `${firstName} ${lastName}`.trim(),
      email,
      phone: phone || '-',
      program: item.title,
      status: 'Guest submitted',
      fee: feeText,
      amount: feeAmount,
      registrationType: 'guest'
    };

    event.currentTarget.reset();
    try {
      await saveRegistration(record);
      setGuestSaved(true);
      setRegistrationNotice({
        title: 'Guest registration submitted',
        message: 'We saved the registration and sent the email confirmation. Admin will review it before payment is completed.'
      });
    } catch (error) {
      setGuestError(/already registered/i.test(error.message || '')
        ? error.message
        : error.localSaved
          ? 'Guest registration was saved locally, but could not reach the server.'
          : error.message || 'Guest registration could not be submitted.');
    }
  }

  async function handleMemberSubmit(event) {
    event.preventDefault();
    setMemberSaved(false);
    setMemberError('');

    const member = memberOptions.find((option) => option.value === selectedMember);
    if (!user) {
      setMemberError('Please login before registering for this class.');
      return;
    }
    if (!member) {
      setMemberError('Please select the member to register.');
      return;
    }

    const existing = readJson('kb-registration-submissions', []).some((registration) => (
      String(registration.email || '').toLowerCase() === String(user.email || '').toLowerCase()
      && registration.program === item.title
      && (registration.studentName === member.name || registration.familyMember === member.name)
      && registration.status !== 'Deleted'
      && registration.enabled !== false
    ));
    if (existing) {
      setMemberError('This member is already registered for this class.');
      return;
    }

    const record = {
      parentName: user.name || user.email,
      studentName: member.name,
      familyMember: member.name,
      birthYear: member.birthYear,
      email: user.email,
      phone: user.phone || '-',
      program: item.title,
      status: 'Submitted',
      fee: feeText,
      amount: feeAmount,
      registrationType: 'class',
      seats: 1,
      totalMembers: 1
    };

    try {
      await saveRegistration(record);
      setMemberSaved(true);
      setShowGuestForm(false);
      setRegistrationNotice({
        title: 'Registration submitted',
        message: 'We saved the class registration and sent the email confirmation. Wait for approval before completing payment.'
      });
    } catch (error) {
      setMemberError(/already registered/i.test(error.message || '')
        ? error.message
        : error.localSaved
          ? 'Registration was saved locally, but could not reach the server.'
          : error.message || 'Registration could not be submitted.');
    }
  }

  return (
    <>
      <article className="class-card">
        <div className="class-card-media">
          <img className="card-photo" src={classImage} alt={`${item.title} class`} />
          <div className="class-card-media-copy">
            <span>{item.category || 'Language'}</span>
            <h3>{item.title}</h3>
          </div>
        </div>
        <div className="card-topline">
          <span className="pill">{item.category || 'Language'}</span>
          <span>{item.status || item.fee}</span>
        </div>
        <p>{item.focus || `${item.title} classes for Kannada Bharati families and community learners.`}</p>
        <ul className="icon-list">
          <li><CalendarDays size={17} /> {item.date || 'Sep 13, 2026 - Jun 20, 2027'}</li>
          <li><Clock size={17} /> {item.time}</li>
          <li><UserRound size={17} /> {item.age}</li>
          <li><MapPin size={17} /> {item.location || 'Virtual Google Classroom'}</li>
        </ul>
        <div className="class-card-actions">
          <button className="button secondary-dark" type="button" onClick={() => setShowDetails(true)}>
            {tr('Details')}
          </button>
          <button className="button compact" type="button" onClick={openMemberRegistration}>
            {tr('Register')}
          </button>
        </div>
      </article>

      {showDetails && (
        <div className="popup-backdrop" role="presentation">
          <div className="popup-panel class-detail-popup" role="dialog" aria-modal="true" aria-label={`${item.title} class details`}>
            <button className="popup-close" type="button" aria-label="Close class details" onClick={() => setShowDetails(false)}>
              <X size={20} />
            </button>
            <div className="class-detail-hero">
              <img src={classImage} alt={`${item.title} class`} />
              <div>
                <span>{item.category || 'Language'}</span>
                <h2>{item.title}</h2>
                <p>{item.focus || `${item.title} classes for Kannada Bharati families and community learners.`}</p>
              </div>
            </div>
            <div className="class-detail-grid">
              <article><span>Status</span><strong>{item.status || 'Open'}</strong></article>
              <article><span>Date</span><strong>{item.date || 'Sep 13, 2026 - Jun 20, 2027'}</strong></article>
              <article><span>Time</span><strong>{item.time || '-'}</strong></article>
              <article><span>Age</span><strong>{item.age || '-'}</strong></article>
              <article><span>Donation/Fee</span><strong>{feeText}</strong></article>
              <article><span>Location</span><strong>{item.location || 'Virtual Google Classroom'}</strong></article>
            </div>
            <section className="class-registration-process">
              <h3>{tr('Registration process')}</h3>
              <ol>
                <li>{tr('Submit Registration')}</li>
                <li>Wait for <strong>Approved</strong> email as confirmation</li>
                <li>After receiving Approved email, <strong>donate</strong> {feeText}</li>
                <li>Receive payment confirmation as proof of registration</li>
              </ol>
            </section>
            <div className="class-detail-actions">
              <button className="button primary" type="button" onClick={openMemberRegistration}>
                {tr('Register')}
              </button>
              <button className="button primary" type="button" onClick={() => { setShowGuestForm((value) => !value); setGuestError(''); }}>
                {tr('Register as Guest')}
              </button>
            </div>
            {showMemberRegister && (
              <form className="guest-registration-form member-registration-form" onSubmit={handleMemberSubmit}>
                <div className="notice-box">
                  Need to add a new person? Update it in your <Link to="/admin/profile">account</Link>.
                </div>
                <label>
                  Please select the member(s) to register <b>*</b>
                  <select value={selectedMember} onChange={(event) => setSelectedMember(event.target.value)} required>
                    <option value="">-- Please select --</option>
                    {memberOptions.map((member) => (
                      <option key={member.value} value={member.value}>{member.label}</option>
                    ))}
                  </select>
                </label>
                {!user && <p className="fine-print">Please <Link to="/login">login</Link> or <Link to={registerUrl}>create an account</Link> before registering.</p>}
                {user && memberOptions.length === 1 && <p className="fine-print">Only self is available right now. Add spouse or children in your account profile to show them here.</p>}
                {memberError && <p className="form-error">{memberError}</p>}
                {memberSaved && <p className="success">Registration submitted. Admin will review and approve it before payment is completed.</p>}
                <button className="blue-submit" type="submit" disabled={!user}>{tr('Register')}</button>
              </form>
            )}
            {showGuestForm && (
              <form className="guest-registration-form" onSubmit={handleGuestSubmit}>
                <h3>{tr('Guest Registration')}</h3>
                <div className="form-two">
                  <label>First name <input name="firstName" required minLength="2" maxLength="40" /></label>
                  <label>Last name <input name="lastName" required minLength="2" maxLength="40" /></label>
                </div>
                <label>Student / participant name <input name="studentName" maxLength="80" placeholder="Leave blank if same as parent" /></label>
                <div className="form-two">
                  <label>Email <input name="email" type="email" required /></label>
                  <label>Phone <input name="phone" type="tel" placeholder="425 555 0100" /></label>
                </div>
                {guestError && <p className="form-error">{guestError}</p>}
                {guestSaved && <p className="success">Guest registration submitted. Admin will review and approve it before payment is completed.</p>}
                <button className="button primary" type="submit">{tr('Submit Registration')}</button>
              </form>
            )}
          </div>
        </div>
      )}
      {registrationNotice && (
        <div className="popup-backdrop registration-message-backdrop" role="presentation">
          <div className="popup-panel registration-message-popup" role="dialog" aria-modal="true" aria-label={registrationNotice.title}>
            <button className="popup-close" type="button" aria-label="Close message" onClick={() => setRegistrationNotice(null)}>
              <X size={20} />
            </button>
            <span className="registration-message-icon"><CheckCircle2 size={34} /></span>
            <h2>{registrationNotice.title}</h2>
            <p>{registrationNotice.message}</p>
            <button className="button primary" type="button" onClick={() => setRegistrationNotice(null)}>{tr('Done')}</button>
          </div>
        </div>
      )}
    </>
  );
}
