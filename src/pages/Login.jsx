import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, KeyRound, Mail, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { appendRecord, setCurrentUser } from '../utils/storage.js';
import { apiLogin } from '../utils/api.js';

export default function Login() {
  const navigate = useNavigate();

  async function loginWithEmail(email, password = '') {
    const normalized = email.trim().toLowerCase();
    let user;
    try {
      user = await apiLogin({ email: normalized, password });
    } catch {
      user = {
        email: normalized,
        name: normalized === 'test@gmail.com' ? 'Admin' : normalized.split('@')[0],
        role: normalized === 'test@gmail.com' ? 'admin' : 'member'
      };
      appendRecord('kb-login-submissions', user);
    }
    setCurrentUser(user);
    navigate(user.role === 'admin' ? '/admin' : '/classes');
  }

  function handleSubmit(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    loginWithEmail(payload.email, payload.password);
  }

  return (
    <main className="account-page login-page">
      <section className="login-shell" aria-labelledby="login-title">
        <aside className="login-welcome">
          <img src="/assets/kannada-bharati-logo.png" alt="Kannada Bharati logo" />
          <span className="register-eyebrow">Member login</span>
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to continue with Kannada Bharati classes, events, donations, volunteering, and admin tools.</p>
          <div className="register-benefits">
            <span><UsersRound size={18} /> Member activity access</span>
            <span><CalendarDays size={18} /> Events and class updates</span>
            <span><ShieldCheck size={18} /> Admin dashboard for test@gmail.com</span>
          </div>
        </aside>

        <div className="login-panel">
          <div className="login-card-heading">
            <span><Sparkles size={18} /> Continue securely</span>
            <h2>Log in to your account</h2>
          </div>

          <div className="social-area">
          <p>Continuing with social login will automatically create an account.</p>
            <div className="social-row">
              <button className="social-button google" type="button" onClick={() => loginWithEmail('google.member@example.com')}>
                <span>G</span>
                Google
              </button>
              <button className="social-button facebook" type="button" onClick={() => loginWithEmail('facebook.member@example.com')}>
                <span>f</span>
                Facebook
              </button>
            </div>
          </div>

          <div className="or-divider">
            <span />
            <strong>Or</strong>
            <span />
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-input-group">
              <span className="input-icon"><Mail size={18} /></span>
              <input name="email" type="email" required placeholder="Email" autoComplete="email" />
            </label>
            <label className="login-input-group">
              <span className="input-icon"><KeyRound size={18} /></span>
              <input name="password" type="password" required placeholder="Password" autoComplete="current-password" />
            </label>

            <div className="login-options">
              <label>
                <input name="remember" type="checkbox" />
                Remember me
              </label>
              <Link to="/contact">Forgot password?</Link>
            </div>

            <button className="blue-submit" type="submit">Log in</button>
            <p className="fine-print admin-login-note">Admin demo: use test@gmail.com with any password.</p>
          </form>

          <div className="login-footer-links">
            <Link to="/register">Create an account with password</Link>
            <Link to="/contact">Need help?</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
