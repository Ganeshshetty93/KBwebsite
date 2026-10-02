import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, KeyRound, Mail, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { appendRecord, defaultAdminPath, hasAnyRole, isAdmin, setCurrentUser } from '../utils/storage.js';
import { apiConfirmEmail, apiForgotPassword, apiGoogleLogin, apiLogin, apiResetPassword } from '../utils/api.js';
import { cleanText, firstError, validateEmail, validatePassword } from '../utils/validation.js';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'ganeshshetty93@gmail.com').toLowerCase();
const staffRoles = ['receptionist', 'teacher', 'volunteer', 'treasurer'];

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

function loginDestination(user) {
  return isAdmin(user) || hasAnyRole(user, staffRoles) ? defaultAdminPath(user) : '/classes';
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const googleTokenClientRef = useRef(null);
  const resetToken = searchParams.get('resetToken');
  const confirmToken = searchParams.get('confirmToken');

  useEffect(() => {
    if (!confirmToken) return;
    apiConfirmEmail(confirmToken)
      .then((user) => {
        setCurrentUser(user);
        setNotice('Email confirmed. You are signed in.');
      })
      .catch((confirmError) => setError(confirmError.message || 'Email confirmation failed.'));
  }, [confirmToken]);

  async function loginWithEmail(email, password = '') {
    const normalized = email.trim().toLowerCase();
    let user;
    try {
      user = await apiLogin({ email: normalized, password });
    } catch {
      user = {
        email: normalized,
        name: normalized === adminEmail ? 'Admin' : normalized.split('@')[0],
        role: normalized === adminEmail ? 'admin' : 'member'
      };
      appendRecord('kb-login-submissions', user);
    }
    setCurrentUser(user);
    navigate(loginDestination(user));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const email = cleanText(payload.email).toLowerCase();
    const validationError = firstError([
      validateEmail(email),
      validatePassword(payload.password)
    ]);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (resetToken) {
      apiResetPassword({ token: resetToken, password: payload.password })
        .then((user) => {
          setCurrentUser(user);
          navigate(loginDestination(user));
        })
        .catch((resetError) => setError(resetError.message || 'Password reset failed.'));
      return;
    }

    loginWithEmail(email, payload.password);
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const email = cleanText(new FormData(event.currentTarget.form).get('email')).toLowerCase();
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await apiForgotPassword(email);
      setNotice('Password reset instructions were queued for that email.');
    } catch (forgotError) {
      setError(forgotError.message || 'Could not start password reset.');
    }
  }

  async function handleGoogleLogin() {
    setError('');

    if (!googleClientId) {
      setError('Google login is not configured.');
      return;
    }

    try {
      await loadGoogleIdentityScript();
      googleTokenClientRef.current ||= window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        callback: async (response) => {
          if (response.error) {
            setError(response.error_description || 'Google login failed.');
            return;
          }

          try {
            const user = await apiGoogleLogin({ accessToken: response.access_token });
            setCurrentUser(user);
            navigate(loginDestination(user));
          } catch (googleError) {
            setError(googleError.message || 'Google login failed.');
          }
        }
      });
      googleTokenClientRef.current.requestAccessToken();
    } catch {
      setError('Google login could not be started.');
    }
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
            <span><ShieldCheck size={18} /> Admin dashboard for {adminEmail}</span>
          </div>
        </aside>

        <div className="login-panel">
          <div className="login-card-heading">
            <span><Sparkles size={18} /> Continue securely</span>
            <h2>{resetToken ? 'Reset your password' : 'Log in to your account'}</h2>
          </div>

          <div className="social-area">
          <p>Continuing with social login will automatically create an account.</p>
            <div className="social-row">
              <button className="social-button google" type="button" onClick={handleGoogleLogin}>
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
              <button className="text-link-button" type="button" onClick={handleForgotPassword}>Forgot password?</button>
            </div>

            <button className="blue-submit" type="submit">{resetToken ? 'Reset password' : 'Log in'}</button>
            {error && <p className="form-error">{error}</p>}
            {notice && <p className="success">{notice}</p>}
            <p className="fine-print admin-login-note">Admin demo: use {adminEmail} with any password.</p>
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
