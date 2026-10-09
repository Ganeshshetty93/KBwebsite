import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Camera, CheckCircle2, ReceiptText, Plus, Trash2, X } from 'lucide-react';
import { getCurrentUser, readJson, setCurrentUser, writeJson } from '../utils/storage.js';
import {
  apiAddProfileChild,
  apiAdminDashboard,
  apiChangePassword,
  apiCompleteFlowPayment,
  apiConfirmPhoneVerification,
  apiCreateFlowPayment,
  apiDeleteProfileChild,
  apiLinkExternalLogin,
  apiReadExternalLogins,
  apiRemovePhone,
  apiReadProfile,
  apiRemoveExternalLogin,
  apiSaveProfile,
  apiSetPassword,
  apiSetTwoFactor,
  apiStartPhoneVerification,
  apiStartTwoFactorSetup,
  apiVerifyTwoFactorSetup,
  apiUploadFile
} from '../utils/api.js';
import { cleanText, firstError, validateImageFile, validatePhone, validateRequired } from '../utils/validation.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import DatePicker from '../components/DatePicker.jsx';

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

function scrollToProfileSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function Profile() {
  const { tr } = useLanguage();
  const user = getCurrentUser();
  const [searchParams] = useSearchParams();
  if (!user) return <Navigate to="/login" replace />;

  const [accountUser, setAccountUser] = useState(user);
  const [profile, setProfile] = useState(() => readJson(profileKey(user.email), {}));
  const [children, setChildren] = useState(() => readJson(childrenKey(user.email), []));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [childError, setChildError] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  const [externalLogins, setExternalLogins] = useState([]);
  const [phoneVerification, setPhoneVerification] = useState({ phone: '', code: '', sent: false, devCode: '' });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(user.twoFactorEnabled));
  const [twoFactorSetup, setTwoFactorSetup] = useState({ setupToken: '', code: '', sent: false, devCode: '' });
  const [registrations, setRegistrations] = useState([]);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const googleTokenClientRef = useRef(null);

  useEffect(() => {
    apiReadProfile()
      .then((records) => {
        if (records.profile && Object.keys(records.profile).length) {
          writeJson(profileKey(user.email), records.profile);
          setProfile(records.profile);
        }
        if (records.children) {
          writeJson(childrenKey(user.email), records.children);
          setChildren(records.children);
        }
      })
      .catch(() => {});
    apiReadExternalLogins()
      .then((records) => setExternalLogins(records.logins || []))
      .catch(() => setExternalLogins([
        { provider: 'Local password', connected: false },
        { provider: 'Google', connected: Boolean(user.emailConfirmed) }
      ]));
    apiAdminDashboard()
      .then((records) => setRegistrations(records.registrations || []))
      .catch(() => setRegistrations(readJson('kb-registration-submissions', []).filter((row) => String(row.email || '').toLowerCase() === String(user.email || '').toLowerCase())));
  }, [user.email]);

  useEffect(() => {
    const token = searchParams.get('token');
    const registrationId = searchParams.get('registrationId');
    const kind = searchParams.get('kind') || 'event';
    const payment = searchParams.get('payment');
    if (payment === 'cancel') {
      setPaymentError('Payment was cancelled.');
      return;
    }
    if (!token || !registrationId || payment !== 'complete') return;
    let ignore = false;
    setPaymentMessage('Confirming payment...');
    apiCompleteFlowPayment(kind, { token, registrationId })
      .then((result) => {
        if (ignore) return;
        setPaymentMessage('Payment confirmed.');
        setRegistrations((current) => current.map((row) => (row.id === registrationId ? result.registration : row)));
        if (result.registration) setSelectedRegistration(result.registration);
      })
      .catch((error) => {
        if (!ignore) setPaymentError(error.message || 'Payment could not be confirmed.');
      });
    return () => {
      ignore = true;
    };
  }, [searchParams]);

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setAccountError('');
    setAccountMessage('');
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (String(payload.newPassword || payload.password || '').length < 6) {
      setAccountError('Password must be at least 6 characters.');
      return;
    }
    if ((payload.newPassword || payload.password) !== payload.confirmPassword) {
      setAccountError('Password confirmation does not match.');
      return;
    }

    try {
      if (payload.currentPassword) {
        await apiChangePassword(payload);
        setAccountMessage('Password changed.');
      } else {
        await apiSetPassword({ password: payload.password || payload.newPassword });
        setAccountMessage('Password created.');
      }
      event.currentTarget.reset();
    } catch (error) {
      setAccountError(error.message || 'Password could not be updated.');
    }
  }

  async function handlePhoneStart(event) {
    event.preventDefault();
    setAccountError('');
    setAccountMessage('');
    const phone = cleanText(new FormData(event.currentTarget).get('phone'));
    const phoneError = validatePhone(phone);
    if (phoneError) {
      setAccountError(phoneError);
      return;
    }
    try {
      const result = await apiStartPhoneVerification(phone);
      setPhoneVerification({ phone, code: '', sent: true, devCode: result.devCode || '' });
      setAccountMessage(result.devCode ? `Verification code generated: ${result.devCode}` : 'Verification code sent.');
    } catch (error) {
      setAccountError(error.message || 'Could not start phone verification.');
    }
  }

  async function handlePhoneConfirm(event) {
    event.preventDefault();
    setAccountError('');
    setAccountMessage('');
    const code = cleanText(new FormData(event.currentTarget).get('code'));
    try {
      const result = await apiConfirmPhoneVerification({ phone: phoneVerification.phone, code });
      if (result.user) {
        setCurrentUser(result.user);
        setAccountUser(result.user);
      }
      setProfile((current) => ({ ...current, phone: phoneVerification.phone }));
      setPhoneVerification({ phone: '', code: '', sent: false, devCode: '' });
      setAccountMessage('Phone number verified.');
    } catch (error) {
      setAccountError(error.message || 'Phone verification failed.');
    }
  }

  async function handleTwoFactorChange(event) {
    const enabled = event.currentTarget.checked;
    setAccountError('');
    setAccountMessage('');
    try {
      if (enabled) {
        const result = await apiStartTwoFactorSetup();
        setTwoFactorSetup({
          setupToken: result.setupToken,
          code: result.devCode || '',
          sent: true,
          devCode: result.devCode || ''
        });
        setAccountMessage(result.devCode ? `Verification code generated: ${result.devCode}` : `A verification code was sent to ${accountUser.email}.`);
        return;
      }

      setTwoFactorEnabled(false);
      setTwoFactorSetup({ setupToken: '', code: '', sent: false, devCode: '' });
      const updatedUser = await apiSetTwoFactor(false);
      setCurrentUser(updatedUser);
      setAccountUser(updatedUser);
      setAccountMessage('Two-factor authentication disabled.');
    } catch (error) {
      setTwoFactorEnabled(Boolean(accountUser.twoFactorEnabled));
      setAccountError(error.message || 'Two-factor setting could not be updated.');
    }
  }

  async function handleVerifyTwoFactorSetup(event) {
    event.preventDefault();
    setAccountError('');
    setAccountMessage('');
    const code = cleanText(new FormData(event.currentTarget).get('code'));
    if (!/^\d{6}$/.test(code)) {
      setAccountError('Enter the six-digit verification code.');
      return;
    }

    try {
      const updatedUser = await apiVerifyTwoFactorSetup({ setupToken: twoFactorSetup.setupToken, code });
      setCurrentUser(updatedUser);
      setAccountUser(updatedUser);
      setTwoFactorEnabled(true);
      setTwoFactorSetup({ setupToken: '', code: '', sent: false, devCode: '' });
      setAccountMessage('Two-factor authentication enabled and verified.');
    } catch (error) {
      setAccountError(error.message || 'Two-factor verification failed.');
    }
  }

  async function startRegistrationPayment(row) {
    setPaymentError('');
    setPaymentMessage('');
    const amount = Number(row.amount || String(row.fee || '').replace(/[^\d.]/g, '') || 0);
    if (!amount || amount <= 0) {
      setPaymentError('This registration does not have a payment amount.');
      return;
    }
    const kind = row.registrationType === 'class' ? 'class' : row.registrationType === 'guest' ? 'guest-event' : 'event';
    try {
      const returnUrl = `${window.location.origin}/admin/profile?payment=complete&kind=${encodeURIComponent(kind)}&registrationId=${encodeURIComponent(row.id || '')}`;
      const cancelUrl = `${window.location.origin}/admin/profile?payment=cancel&registrationId=${encodeURIComponent(row.id || '')}`;
      const payment = await apiCreateFlowPayment(kind, {
        registrationId: row.id,
        email: row.email || user.email,
        name: row.parentName || user.name || user.email,
        familyMember: row.familyMember || row.studentName,
        program: row.program,
        amount,
        description: `${row.program} registration`,
        returnUrl,
        cancelUrl
      });
      if (payment.approvalUrl) window.location.href = payment.approvalUrl;
      else setPaymentError('PayPal approval link was not returned.');
    } catch (error) {
      setPaymentError(error.message || 'Payment could not be started.');
    }
  }

  async function refreshExternalLogins() {
    try {
      const records = await apiReadExternalLogins();
      setExternalLogins(records.logins || []);
    } catch {
      setExternalLogins([
        { provider: 'Local password', connected: false },
        { provider: 'Google', connected: Boolean(user.emailConfirmed) }
      ]);
    }
  }

  async function handleExternalLoginAction(provider, connected) {
    setAccountError('');
    setAccountMessage('');
    try {
      if (connected) {
        await apiRemoveExternalLogin(provider);
        setAccountMessage(`${provider} login removed.`);
      } else if (provider.toLowerCase() === 'google') {
        if (!googleClientId) {
          setAccountError('Google login is not configured.');
          return;
        }
        await loadGoogleIdentityScript();
        const accessToken = await new Promise((resolve, reject) => {
          googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: googleClientId,
            scope: 'openid email profile',
            callback: (response) => {
              if (response.error) reject(new Error(response.error_description || 'Google login failed.'));
              else resolve(response.access_token);
            }
          });
          googleTokenClientRef.current.requestAccessToken();
        });
        await apiLinkExternalLogin(provider, { accessToken });
        setAccountMessage(`${provider} login connected.`);
      } else {
        await apiLinkExternalLogin(provider);
        setAccountMessage(`${provider} login connected.`);
      }
      await refreshExternalLogins();
    } catch (error) {
      setAccountError(error.message || `${provider} login could not be updated.`);
    }
  }

  async function handleRemovePhone() {
    setAccountError('');
    setAccountMessage('');
    try {
      const result = await apiRemovePhone();
      if (result.user) {
        setCurrentUser(result.user);
        setAccountUser(result.user);
      }
      setProfile((current) => ({ ...current, phone: '' }));
      setPhoneVerification({ phone: '', code: '', sent: false, devCode: '' });
      setAccountMessage('Phone number removed.');
    } catch (error) {
      setAccountError(error.message || 'Phone number could not be removed.');
    }
  }

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
      imageError
    ]);

    if (validationError) {
      setError(validationError);
      return;
    }

    const photoDataUrl = await fileToDataUrl(photoFile);
    let photo = photoDataUrl || profile.photo || '';
    if (photoDataUrl) {
      try {
        const upload = await apiUploadFile({
          dataUrl: photoDataUrl,
          fileName: photoFile.name,
          container: 'users',
          directory: user.email
        });
        photo = upload.url || photoDataUrl;
      } catch {
        photo = photoDataUrl;
      }
    }

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
      photo,
      updatedAt: new Date().toISOString()
    };

    let savedProfile = nextProfile;
    try {
      savedProfile = await apiSaveProfile(nextProfile);
    } catch {
      savedProfile = nextProfile;
    }

    writeJson(profileKey(user.email), savedProfile);
    setProfile(savedProfile);
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

    let child = {
      id: `child-${Date.now()}`,
      firstName: cleanText(payload.firstName),
      lastName: cleanText(payload.lastName),
      gender: payload.gender,
      birthDate: payload.birthDate
    };
    apiAddProfileChild(child)
      .then((savedChild) => {
        const next = [...children, savedChild];
        writeJson(childrenKey(user.email), next);
        setChildren(next);
        window.dispatchEvent(new Event('kb-data-change'));
      })
      .catch(() => {});
    const nextChildren = [...children, child];
    writeJson(childrenKey(user.email), nextChildren);
    setChildren(nextChildren);
    form.reset();
    window.dispatchEvent(new Event('kb-data-change'));
  }

  function removeChild(id) {
    const nextChildren = children.filter((child) => child.id !== id);
    writeJson(childrenKey(user.email), nextChildren);
    setChildren(nextChildren);
    apiDeleteProfileChild(id).catch(() => {});
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
            <button type="button" onClick={() => scrollToProfileSection('account-password')}><strong>Password</strong><em>Create</em></button>
            <button type="button" onClick={() => scrollToProfileSection('external-logins')}><strong>External logins</strong><em>Manage</em></button>
            <button type="button" onClick={() => scrollToProfileSection('two-factor') }><strong>Two-factor</strong><em>{twoFactorEnabled ? 'Enabled' : 'Disabled'}</em></button>
          </div>
        </aside>

        <section className="member-profile-content">
          <form id="profile-information" className="member-profile-form" onSubmit={handleProfileSubmit}>
            <div className="profile-section-heading">
              <span>Account</span>
              <h2>Profile information</h2>
              <p>Update member, spouse, address, and profile image details.</p>
            </div>
            <label className="profile-photo-field">
              Profile picture <small>(jpg/jpeg/png)</small>
              <input name="profilePhoto" type="file" accept="image/png,image/jpeg" />
            </label>
            <div className="form-two">
              <label>First name *<input name="firstName" defaultValue={profile.firstName || user.firstName || user.name?.split(' ')[0] || ''} required /></label>
              <label>Last name *<input name="lastName" defaultValue={profile.lastName || user.lastName || user.name?.split(' ').slice(1).join(' ') || ''} required /></label>
            </div>
            <div className="form-two">
              <label>Birth month and year *<DatePicker name="birthDate" mode="month" defaultValue={profile.birthDate || ''} required placeholder="Choose month and year" /></label>
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
            <label>Birth month and year<DatePicker name="spouseBirthDate" mode="month" defaultValue={profile.spouseBirthDate || ''} placeholder="Choose month and year" /></label>

            {error && <p className="form-error">{error}</p>}
            {saved && <p className="success">Profile saved.</p>}
            <button className="button primary" type="submit">Save Profile</button>
          </form>

          <section className="member-profile-form account-security-panel">
            <div className="profile-section-heading">
              <span>Security</span>
              <h2>Account security</h2>
              <p>Manage password, connected logins, phone verification, and two-factor authentication.</p>
            </div>
            {accountError && <p className="form-error">{accountError}</p>}
            {accountMessage && <p className="success">{accountMessage}</p>}
            <form id="account-password" className="account-security-grid" onSubmit={handlePasswordSubmit}>
              <label>Current password <input name="currentPassword" type="password" placeholder="Leave blank to create password" /></label>
              <label>New password <input name="newPassword" type="password" minLength="6" required /></label>
              <label>Confirm password <input name="confirmPassword" type="password" minLength="6" required /></label>
              <button className="button primary" type="submit">Save Password</button>
            </form>
            <div id="external-logins" className="account-login-list">
              <h3>External logins</h3>
              <div className="external-login-grid">
                {externalLogins.map((login) => (
                  <article key={login.provider}>
                    <strong>{login.provider}</strong>
                    <span>
                      <em className={login.connected ? 'is-connected' : ''}>{login.connected ? 'Connected' : 'Not connected'}</em>
                      {login.provider !== 'Local password' && (
                        <button className="mini-action-link secondary" type="button" onClick={() => handleExternalLoginAction(login.provider, login.connected)}>
                          {login.connected ? 'Remove' : 'Connect'}
                        </button>
                      )}
                    </span>
                  </article>
                ))}
              </div>
            </div>
            <p className={`phone-verification-status${accountUser.phoneConfirmed ? ' is-verified' : ''}`}>
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>
                <strong>{accountUser.phoneConfirmed ? 'Phone verified' : 'Phone not verified'}</strong>
                <small>{accountUser.phoneConfirmed ? 'Phone OTP login is available for this account.' : 'Verify your number below before using Phone OTP login.'}</small>
              </span>
            </p>
            <form className="account-security-grid" onSubmit={handlePhoneStart}>
              <label>Phone number <input name="phone" type="tel" defaultValue={profile.phone || user.phone || ''} required /></label>
              <button className="button secondary-dark" type="submit">Send Verification Code</button>
            </form>
            {phoneVerification.sent && (
              <form className="account-security-grid" onSubmit={handlePhoneConfirm}>
                <label>Verification code <input name="code" defaultValue={phoneVerification.devCode} required /></label>
                <button className="button primary" type="submit">Verify Phone</button>
              </form>
            )}
            {(profile.phone || accountUser.phone) && (
              <button className="mini-action-link danger" type="button" onClick={handleRemovePhone}>Remove phone number</button>
            )}
            <label id="two-factor" className="security-toggle">
              <span>
                <strong>Two-factor authentication</strong>
                <small>Add an extra verification step during login.</small>
              </span>
              <input type="checkbox" checked={twoFactorEnabled} disabled={twoFactorSetup.sent} onChange={handleTwoFactorChange} />
              <em>{twoFactorEnabled ? 'Enabled' : twoFactorSetup.sent ? 'Verify code' : 'Disabled'}</em>
            </label>
            {twoFactorSetup.sent && !twoFactorEnabled && (
              <form className="account-security-grid two-factor-setup-form" onSubmit={handleVerifyTwoFactorSetup}>
                <label>
                  Verification code
                  <input
                    name="code"
                    value={twoFactorSetup.code}
                    onChange={(event) => setTwoFactorSetup((current) => ({ ...current, code: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    required
                  />
                </label>
                <button className="button primary" type="submit">Verify and Enable 2FA</button>
                <button
                  className="button secondary-dark"
                  type="button"
                  onClick={() => { setTwoFactorSetup({ setupToken: '', code: '', sent: false, devCode: '' }); setAccountMessage(''); }}
                >
                  Cancel
                </button>
              </form>
            )}
          </section>

          <section className="member-profile-form">
            <div className="profile-section-heading">
              <span>Payments</span>
              <h2>My class and event registrations</h2>
              <p>Review registered members, status, amount, and payment confirmation.</p>
            </div>
            {paymentError && <p className="form-error">{paymentError}</p>}
            {paymentMessage && <p className="success">{paymentMessage}</p>}
            <div className="table-scroll">
              <table>
                <thead><tr><th>{tr('Registered on')}</th><th>{tr('Program')}</th><th>{tr('Member')}</th><th>{tr('Status')}</th><th>{tr('Amount')}</th><th>{tr('Paid')}</th><th>{tr('Action')}</th></tr></thead>
                <tbody>
                  {registrations.length ? registrations.map((row) => {
                    const paid = row.paid || row.paymentReceived;
                    return (
                      <tr key={row.id || `${row.program}-${row.createdAt}`}>
                        <td>{row.createdAt || row.created_at || '-'}</td>
                        <td>{row.program || '-'}</td>
                        <td>{row.familyMember || row.studentName || '-'}</td>
                        <td>{tr(row.status || 'Submitted')}</td>
                        <td>${Number(row.amount || 0).toLocaleString()}</td>
                        <td>{tr(paid ? 'Paid' : 'Pending')}</td>
                        <td>
                          <div className="admin-row-actions">
                            <button className="mini-action-link secondary" type="button" onClick={() => setSelectedRegistration(row)}>{tr('Details')}</button>
                            {paid ? <span className="confirmed-badge">{tr('Confirmed')}</span> : <button className="mini-action-link success" type="button" onClick={() => startRegistrationPayment(row)}>{tr('Pay now')}</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  }) : <tr><td colSpan="7">{tr('No class or event registrations yet.')}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="member-profile-form">
            <div className="profile-section-heading">
              <span>Family</span>
              <h2>Children info</h2>
              <p>Add children here so class registration can show them in the member dropdown.</p>
            </div>
            <form className="child-inline-form" onSubmit={handleChildSubmit}>
              <input name="firstName" placeholder="First name" />
              <input name="lastName" placeholder="Last name" />
              <select name="gender" defaultValue="">
                <option value="" disabled>Gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Prefer not to say</option>
              </select>
              <DatePicker name="birthDate" placeholder="Child date of birth" />
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
      {selectedRegistration && (
        <div className="popup-backdrop" role="presentation">
          <div className="popup-panel payment-detail-popup" role="dialog" aria-modal="true" aria-label="Registration payment details">
            <button className="popup-close" type="button" aria-label="Close payment details" onClick={() => setSelectedRegistration(null)}><X size={20} /></button>
            <div className="payment-detail-heading">
              <span>{selectedRegistration.registrationType || 'Registration'}</span>
              <h2>{selectedRegistration.program || 'Registration details'}</h2>
              <p>{selectedRegistration.familyMember || selectedRegistration.studentName || user.email}</p>
            </div>
            <section className="payment-confirmation-grid">
              <article><ReceiptText size={22} /><span>{tr('Status')}</span><strong>{tr(selectedRegistration.status || 'Submitted')}</strong></article>
              <article><CheckCircle2 size={22} /><span>{tr('Payment')}</span><strong>{tr(selectedRegistration.paid || selectedRegistration.paymentReceived ? 'Paid' : 'Pending')}</strong></article>
              <article><ReceiptText size={22} /><span>{tr('Amount')}</span><strong>${Number(selectedRegistration.amount || 0).toFixed(2)}</strong></article>
            </section>
            <div className="payment-detail-list">
              <span><strong>{tr('Registered by')}</strong>{selectedRegistration.email || user.email}</span>
              <span><strong>{tr('Registered on')}</strong>{selectedRegistration.createdAt || selectedRegistration.created_at || '-'}</span>
              <span><strong>{tr('Family member')}</strong>{selectedRegistration.familyMember || selectedRegistration.studentName || '-'}</span>
              <span><strong>{tr('Total members')}</strong>{selectedRegistration.totalMembers || selectedRegistration.seats || 1}</span>
              <span><strong>RSVP</strong>{typeof selectedRegistration.rsvp === 'string' ? selectedRegistration.rsvp || '-' : selectedRegistration.rsvp?.question || '-'}</span>
              <span><strong>Price option</strong>{selectedRegistration.priceSelection || '-'}</span>
            </div>
            {!(selectedRegistration.paid || selectedRegistration.paymentReceived) && (
              <button className="button primary" type="button" onClick={() => startRegistrationPayment(selectedRegistration)}>{tr('Pay now')}</button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
