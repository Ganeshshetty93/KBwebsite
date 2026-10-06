import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, Mail, ShieldCheck, Smartphone, UsersRound } from 'lucide-react';
import { setCurrentUser } from '../utils/storage.js';
import { apiConfirmPhoneVerification, apiRegister, apiStartPhoneVerification } from '../utils/api.js';
import { cleanText, firstError, validateEmail, validatePassword, validatePhone, validateRequired } from '../utils/validation.js';

const recaptchaSiteKey = import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY || '';

export default function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [phoneVerification, setPhoneVerification] = useState({ phone: '', code: '', sent: false, devCode: '', verified: false });
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const recaptchaRef = useRef(null);
  const selectedProgram = params.get('program') || 'General membership';

  useEffect(() => {
    if (!recaptchaSiteKey || !recaptchaRef.current) return undefined;
    let cancelled = false;
    const scriptId = 'google-recaptcha-script';
    const renderCaptcha = () => {
      if (cancelled || !window.grecaptcha || !recaptchaRef.current || recaptchaRef.current.dataset.rendered) return;
      window.grecaptcha.render(recaptchaRef.current, {
        sitekey: recaptchaSiteKey,
        callback: (token) => setRecaptchaToken(token),
        'expired-callback': () => setRecaptchaToken('')
      });
      recaptchaRef.current.dataset.rendered = 'true';
    };

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = renderCaptcha;
      document.body.appendChild(script);
    } else {
      window.grecaptcha?.ready?.(renderCaptcha);
      renderCaptcha();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (saved) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [saved]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const firstName = cleanText(payload.firstName);
    const lastName = cleanText(payload.lastName);
    const email = cleanText(payload.email).toLowerCase();
    const phone = cleanText(payload.phone);
    const validationError = firstError([
      validateRequired(firstName, 'First name'),
      validateRequired(lastName, 'Last name'),
      validateEmail(email),
      validatePassword(payload.password),
      validatePassword(payload.confirmPassword, 'Confirm password'),
      validatePhone(phone)
    ]);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (payload.password !== payload.confirmPassword) {
      setError('Password and confirm password must match.');
      return;
    }

    if (recaptchaSiteKey && !recaptchaToken) {
      setError('Please complete the reCAPTCHA security check.');
      return;
    }

    if (!recaptchaSiteKey && !payload.captcha) {
      setError('Please confirm the security check.');
      return;
    }

    const user = {
      firstName,
      lastName,
      parentName: `${firstName} ${lastName}`.trim(),
      studentName: '-',
      email,
      phone: phone || '-',
      program: selectedProgram,
      role: 'member'
    };

    let savedUser;
    try {
      savedUser = await apiRegister({
        ...user,
        phone: phone || null,
        name: user.parentName,
        password: payload.password,
        recaptchaToken
      });
      setCurrentUser(savedUser);
    } catch (registerError) {
      setError(registerError.message || 'Account could not be created. Please check your details and try again.');
      return;
    }
    form.reset();
    setSaved(true);
    if (!phone) {
      window.setTimeout(() => navigate('/admin/profile'), 1800);
      return;
    }

    try {
      const result = await apiStartPhoneVerification(phone);
      setPhoneVerification({ phone, code: result.devCode || '', sent: true, devCode: result.devCode || '', verified: false });
      setNotice(result.devCode ? `Phone verification code generated: ${result.devCode}` : `A verification code was sent to ${phone}.`);
    } catch (phoneError) {
      setError(phoneError.message || 'Your account was created, but phone verification could not be started. You can verify it from your profile.');
    }
  }

  async function handleConfirmPhone(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const code = cleanText(new FormData(event.currentTarget).get('code'));
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit verification code.');
      return;
    }

    try {
      const result = await apiConfirmPhoneVerification({ phone: phoneVerification.phone, code });
      if (result.user) setCurrentUser(result.user);
      setPhoneVerification((current) => ({ ...current, verified: true }));
      setNotice('Phone verified. Phone OTP login is now enabled.');
      window.setTimeout(() => navigate('/admin/profile'), 1200);
    } catch (phoneError) {
      setError(phoneError.message || 'Phone verification failed.');
    }
  }

  return (
    <main className="account-page register-page">
      <section className={`register-shell${saved ? ' is-success' : ''}`} aria-labelledby={saved ? 'registration-success-title' : 'register-title'}>
        <aside className="register-welcome">
          <img src="/assets/kannada-bharati-logo.png" alt="Kannada Bharati logo" />
          <span className="register-eyebrow">Kannada Bharati member access</span>
          <h1 id="register-title">Create a new account</h1>
          <p>Join classes, register for events, volunteer, and keep your Kannada Bharati activity in one place.</p>
          <div className="register-benefits">
            <span><UsersRound size={18} /> Family and student registration</span>
            <span><Mail size={18} /> Event and class updates</span>
            <span><ShieldCheck size={18} /> Secure account access</span>
          </div>
        </aside>

        <div className="register-card">
          {saved ? (
            <div className="registration-success-state" role="status" aria-live="polite">
              <span><CheckCircle2 size={34} /></span>
              <h2 id="registration-success-title">Registered successfully</h2>
              {phoneVerification.sent && !phoneVerification.verified ? (
                <>
                  <p>Your account is ready. Verify <strong>{phoneVerification.phone}</strong> to enable phone OTP login.</p>
                  <form className="registration-phone-verification" onSubmit={handleConfirmPhone}>
                    <label className="login-input-group">
                      <span className="input-icon"><KeyRound size={18} /></span>
                      <input
                        name="code"
                        value={phoneVerification.code}
                        onChange={(event) => setPhoneVerification((current) => ({ ...current, code: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        placeholder="Six-digit phone OTP"
                        autoComplete="one-time-code"
                        required
                      />
                    </label>
                    <button className="blue-submit" type="submit"><Smartphone size={18} /> Verify phone</button>
                  </form>
                </>
              ) : (
                <p>{phoneVerification.verified ? 'Your phone number is verified. Opening your member profile now.' : 'Your account is ready and you are signed in. Opening your member profile now.'}</p>
              )}
              {error && <p className="form-error">{error}</p>}
              {notice && <p className="success">{notice}</p>}
              <button className="blue-submit" type="button" onClick={() => navigate('/admin/profile')}>Continue to my account</button>
            </div>
          ) : (
            <>
          <div className="register-card-heading">
            <span><CheckCircle2 size={18} /> New member</span>
            <h2>Create your account</h2>
            <p>Use your email and password to sign in later.</p>
          </div>

          <form className="account-form" onSubmit={handleSubmit}>
            <div className="form-two">
              <label>
                <span className="field-title">First name <b>*</b></span>
                <input name="firstName" type="text" autoComplete="given-name" minLength="2" maxLength="40" required />
              </label>
              <label>
                <span className="field-title">Last name <b>*</b></span>
                <input name="lastName" type="text" autoComplete="family-name" minLength="2" maxLength="40" required />
              </label>
            </div>
            <label>
              <span className="field-title">Email <b>*</b></span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <div className="form-two">
              <label>
                <span className="field-title">Password <b>*</b></span>
                <input name="password" type="password" autoComplete="new-password" minLength="6" required />
              </label>
              <label>
                <span className="field-title">Confirm password <b>*</b></span>
                <input name="confirmPassword" type="password" autoComplete="new-password" minLength="6" required />
              </label>
            </div>
            <label>
              <span className="field-title">Phone number</span>
              <input name="phone" type="tel" autoComplete="tel" placeholder="425 555 0100" />
            </label>

            {recaptchaSiteKey ? (
              <div className="captcha-widget" ref={recaptchaRef} />
            ) : (
              <label className="captcha-box">
                <input name="captcha" type="checkbox" />
                <span className="captcha-check" aria-hidden="true" />
                <span>I'm not a robot</span>
                <span className="captcha-mark">reCAPTCHA</span>
              </label>
            )}

            {error && <p className="form-error">{error}</p>}
            <button className="blue-submit" type="submit">Create account</button>
          </form>

          <p className="account-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
