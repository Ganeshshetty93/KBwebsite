import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Mail, ShieldCheck, UsersRound } from 'lucide-react';
import { appendRecord, setCurrentUser } from '../utils/storage.js';
import { apiRegister } from '../utils/api.js';

export default function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const selectedProgram = params.get('program') || 'General membership';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (payload.password !== payload.confirmPassword) {
      setError('Password and confirm password must match.');
      return;
    }

    if (!payload.captcha) {
      setError('Please confirm the security check.');
      return;
    }

    const user = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      parentName: `${payload.firstName} ${payload.lastName}`.trim(),
      studentName: '-',
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone || '-',
      program: selectedProgram,
      role: 'member'
    };

    try {
      const savedUser = await apiRegister({
        ...user,
        name: user.parentName,
        password: payload.password
      });
      setCurrentUser(savedUser);
    } catch {
      appendRecord('kb-registration-submissions', user);
      setCurrentUser({
        email: user.email,
        name: user.parentName,
        role: 'member'
      });
    }
    event.currentTarget.reset();
    setSaved(true);
    window.setTimeout(() => navigate('/classes'), 900);
  }

  return (
    <main className="account-page register-page">
      <section className="register-shell" aria-labelledby="register-title">
        <aside className="register-welcome">
          <img src="/assets/kannada-bharati-logo.png" alt="Kannada Bharati logo" />
          <span className="register-eyebrow">Kannada Bharati member access</span>
          <h1 id="register-title">Create a new account</h1>
          <p>Join classes, register for events, volunteer, and keep your Kannada Bharati activity in one place.</p>
          <div className="register-benefits">
            <span><UsersRound size={18} /> Family and student registration</span>
            <span><Mail size={18} /> Event and class updates</span>
            <span><ShieldCheck size={18} /> Simple local demo login</span>
          </div>
        </aside>

        <div className="register-card">
          <div className="register-card-heading">
            <span><CheckCircle2 size={18} /> New member</span>
            <h2>Create your account</h2>
            <p>Use your email and password to sign in later.</p>
          </div>

          <form className="account-form" onSubmit={handleSubmit}>
            <div className="form-two">
              <label>
                <span className="field-title">First name <b>*</b></span>
                <input name="firstName" type="text" autoComplete="given-name" required />
              </label>
              <label>
                <span className="field-title">Last name <b>*</b></span>
                <input name="lastName" type="text" autoComplete="family-name" required />
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
              <input name="phone" type="tel" autoComplete="tel" />
            </label>

            <label className="captcha-box">
              <input name="captcha" type="checkbox" />
              <span className="captcha-check" aria-hidden="true" />
              <span>I'm not a robot</span>
              <span className="captcha-mark">reCAPTCHA</span>
            </label>

            {error && <p className="form-error">{error}</p>}
            {saved && <p className="success">Account created. Opening classes...</p>}

            <button className="blue-submit" type="submit">Create account</button>
          </form>

          <p className="account-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
