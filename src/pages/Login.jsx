import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, KeyRound, Mail, ShieldCheck, Smartphone, Sparkles, UsersRound } from 'lucide-react';
import { defaultAdminPath, hasAnyRole, isAdmin, setCurrentUser } from '../utils/storage.js';
import { apiConfirmEmail, apiForgotPassword, apiGoogleLogin, apiLogin, apiResetPassword, apiSendTwoFactorCode, apiStartOtpLogin, apiStartPhoneOtpLogin, apiVerifyOtpLogin, apiVerifyPhoneOtpLogin, apiVerifyTwoFactorCode } from '../utils/api.js';
import { cleanText, firstError, validateEmail, validatePassword, validatePhone } from '../utils/validation.js';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'ganeshshetty93@gmail.com').toLowerCase();
const staffRoles = ['welcomeDesk', 'teacher', 'volunteer', 'treasurer'];

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
  const [loginMode, setLoginMode] = useState('password');
  const [otpLogin, setOtpLogin] = useState({ email: '', otpToken: '', code: '', sent: false, devCode: '' });
  const [phoneOtpLogin, setPhoneOtpLogin] = useState({ phone: '', otpToken: '', code: '', sent: false, devCode: '' });
  const [twoFactor, setTwoFactor] = useState(null);
  const googleTokenClientRef = useRef(null);
  const resetToken = searchParams.get('resetToken');
  const confirmToken = searchParams.get('confirmToken');

  function beginTwoFactor(result) {
    setTwoFactor({
      token: result.twoFactorToken,
      providers: result.providers || [],
      provider: result.providers?.[0]?.id || 'email',
      challengeId: '',
      verificationToken: '',
      code: '',
      sent: false,
      devCode: ''
    });
    setNotice('Choose a verification method to finish signing in.');
  }

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
    try {
      const result = await apiLogin({ email: normalized, password });
      if (result?.twoFactorRequired) {
        beginTwoFactor(result);
        return;
      }
      setCurrentUser(result);
      navigate(loginDestination(result));
    } catch (loginError) {
      setError(loginError.message || 'Login failed.');
    }
  }

  async function sendOtpLoginCode(email) {
    const normalized = cleanText(email).toLowerCase();
    const validationError = validateEmail(normalized);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setNotice('');
    try {
      const result = await apiStartOtpLogin(normalized);
      setOtpLogin({
        email: normalized,
        otpToken: result.otpToken,
        code: result.devCode || '',
        sent: true,
        devCode: result.devCode || ''
      });
      setNotice(result.devCode ? `Login code generated: ${result.devCode}` : `A six-digit login code was sent to ${normalized}.`);
    } catch (otpError) {
      setError(otpError.message || 'Could not send the login code.');
    }
  }

  function handleStartOtpLogin(event) {
    event.preventDefault();
    sendOtpLoginCode(new FormData(event.currentTarget).get('email'));
  }

  async function handleVerifyOtpLogin(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const code = cleanText(new FormData(event.currentTarget).get('code'));
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit OTP code.');
      return;
    }

    try {
      const result = await apiVerifyOtpLogin({ otpToken: otpLogin.otpToken, code });
      if (result?.twoFactorRequired) {
        beginTwoFactor(result);
        return;
      }
      setCurrentUser(result);
      navigate(loginDestination(result));
    } catch (otpError) {
      setError(otpError.message || 'OTP verification failed.');
    }
  }

  async function sendPhoneOtpLoginCode(phone) {
    const normalized = cleanText(phone);
    const validationError = validatePhone(normalized) || (!normalized ? 'Phone number is required.' : '');
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setNotice('');
    try {
      const result = await apiStartPhoneOtpLogin(normalized);
      setPhoneOtpLogin({
        phone: normalized,
        otpToken: result.otpToken,
        code: result.devCode || '',
        sent: true,
        devCode: result.devCode || ''
      });
      setNotice(result.devCode ? `Login code generated: ${result.devCode}` : 'If this verified phone number is registered, a six-digit login code was sent.');
    } catch (otpError) {
      setError(otpError.message || 'Could not send the phone login code.');
    }
  }

  function handleStartPhoneOtpLogin(event) {
    event.preventDefault();
    sendPhoneOtpLoginCode(new FormData(event.currentTarget).get('phone'));
  }

  async function handleVerifyPhoneOtpLogin(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const code = cleanText(new FormData(event.currentTarget).get('code'));
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit OTP code.');
      return;
    }

    try {
      const result = await apiVerifyPhoneOtpLogin({ otpToken: phoneOtpLogin.otpToken, code });
      if (result?.twoFactorRequired) {
        beginTwoFactor(result);
        return;
      }
      setCurrentUser(result);
      navigate(loginDestination(result));
    } catch (otpError) {
      setError(otpError.message || 'Phone OTP verification failed.');
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const email = cleanText(payload.email).toLowerCase();
    const validationError = resetToken
      ? firstError([validatePassword(payload.password), validatePassword(payload.confirmPassword, 'Confirm password')])
      : firstError([validateEmail(email), validatePassword(payload.password)]);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (resetToken) {
      if (payload.password !== payload.confirmPassword) {
        setError('Password and confirm password must match.');
        return;
      }
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

  async function handleSendTwoFactorCode(event) {
    event.preventDefault();
    if (!twoFactor?.token) return;
    setError('');
    setNotice('');
    try {
      const sent = await apiSendTwoFactorCode({
        twoFactorToken: twoFactor.token,
        provider: twoFactor.provider
      });
      setTwoFactor((current) => ({
        ...current,
        challengeId: sent.challengeId || '',
        verificationToken: sent.verificationToken || '',
        sent: true,
        devCode: sent.devCode || '',
        code: sent.devCode || ''
      }));
      setNotice(sent.devCode ? `Verification code generated: ${sent.devCode}` : `Verification code sent by ${twoFactor.provider === 'phone' ? 'text message' : 'email'}.`);
    } catch (sendError) {
      setError(sendError.message || 'Could not send verification code.');
    }
  }

  async function handleVerifyTwoFactorCode(event) {
    event.preventDefault();
    if (!twoFactor?.token) return;
    setError('');
    setNotice('');
    const code = cleanText(new FormData(event.currentTarget).get('code'));
    if (!code) {
      setError('Verification code is required.');
      return;
    }
    try {
      const user = await apiVerifyTwoFactorCode({
        twoFactorToken: twoFactor.token,
        verificationToken: twoFactor.verificationToken,
        provider: twoFactor.provider,
        code
      });
      setCurrentUser(user);
      navigate(loginDestination(user));
    } catch (verifyError) {
      setError(verifyError.message || 'Verification failed.');
    }
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
            if (user?.twoFactorRequired) {
              beginTwoFactor(user);
              return;
            }
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

          {!resetToken && !twoFactor && (
            <div className="social-area">
            <p>Use a connected provider only after it is configured for this site.</p>
              <div className="social-row">
                <button className="social-button google" type="button" onClick={handleGoogleLogin}>
                  <span>G</span>
                  Google
                </button>
                <button className="social-button facebook" type="button" onClick={() => setError('Facebook login is not configured for this site yet.')}>
                  <span>f</span>
                  Facebook
                </button>
              </div>
            </div>
          )}

          {!twoFactor && <div className="or-divider">
            <span />
            <strong>Or</strong>
            <span />
          </div>}

          {!resetToken && !twoFactor && (
            <div className="auth-mode-switch" role="tablist" aria-label="Choose login method">
              <button
                className={loginMode === 'password' ? 'is-active' : ''}
                type="button"
                role="tab"
                aria-selected={loginMode === 'password'}
                onClick={() => { setLoginMode('password'); setError(''); setNotice(''); }}
              >
                <KeyRound size={17} /> Password
              </button>
              <button
                className={loginMode === 'otp' ? 'is-active' : ''}
                type="button"
                role="tab"
                aria-selected={loginMode === 'otp'}
                onClick={() => { setLoginMode('otp'); setError(''); setNotice(''); }}
              >
                <Mail size={17} /> Email OTP
              </button>
              <button
                className={loginMode === 'phone-otp' ? 'is-active' : ''}
                type="button"
                role="tab"
                aria-selected={loginMode === 'phone-otp'}
                onClick={() => { setLoginMode('phone-otp'); setError(''); setNotice(''); }}
              >
                <Smartphone size={17} /> Phone OTP
              </button>
            </div>
          )}

          {twoFactor ? (
            <div className="login-form two-factor-login-card">
              <form onSubmit={handleSendTwoFactorCode}>
                <label className="login-input-group">
                  <span className="input-icon"><ShieldCheck size={18} /></span>
                  <select value={twoFactor.provider} onChange={(event) => setTwoFactor((current) => ({ ...current, provider: event.target.value, sent: false, challengeId: '', verificationToken: '', code: '', devCode: '' }))}>
                    {twoFactor.providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.label} - {provider.destination}</option>
                    ))}
                  </select>
                </label>
                <button className="blue-submit" type="submit">Send verification code</button>
              </form>
              {twoFactor.sent && (
                <form onSubmit={handleVerifyTwoFactorCode}>
                  <label className="login-input-group">
                    <span className="input-icon"><KeyRound size={18} /></span>
                    <input name="code" defaultValue={twoFactor.devCode} placeholder="Six-digit code" autoComplete="one-time-code" required />
                  </label>
                  <button className="blue-submit" type="submit">Verify and sign in</button>
                </form>
              )}
              <button className="text-link-button" type="button" onClick={() => setTwoFactor(null)}>Use a different account</button>
              {error && <p className="form-error">{error}</p>}
              {notice && <p className="success">{notice}</p>}
            </div>
          ) : loginMode === 'phone-otp' && !resetToken ? (
            <div className="login-form otp-login-card">
              {!phoneOtpLogin.sent ? (
                <form onSubmit={handleStartPhoneOtpLogin}>
                  <label className="login-input-group">
                    <span className="input-icon"><Smartphone size={18} /></span>
                    <input name="phone" type="tel" required placeholder="Verified phone number" autoComplete="tel" />
                  </label>
                  <button className="blue-submit" type="submit">Send phone login code</button>
                </form>
              ) : (
                <form onSubmit={handleVerifyPhoneOtpLogin}>
                  <p className="otp-destination">Enter the code sent to <strong>{phoneOtpLogin.phone}</strong>.</p>
                  <label className="login-input-group">
                    <span className="input-icon"><KeyRound size={18} /></span>
                    <input
                      name="code"
                      value={phoneOtpLogin.code}
                      onChange={(event) => setPhoneOtpLogin((current) => ({ ...current, code: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      placeholder="Six-digit OTP"
                      autoComplete="one-time-code"
                      required
                    />
                  </label>
                  <button className="blue-submit" type="submit">Verify OTP and sign in</button>
                  <div className="otp-login-actions">
                    <button className="text-link-button" type="button" onClick={() => sendPhoneOtpLoginCode(phoneOtpLogin.phone)}>Resend code</button>
                    <button className="text-link-button" type="button" onClick={() => { setPhoneOtpLogin({ phone: '', otpToken: '', code: '', sent: false, devCode: '' }); setNotice(''); }}>Use another number</button>
                  </div>
                </form>
              )}
              {error && <p className="form-error">{error}</p>}
              {notice && <p className="success">{notice}</p>}
              <p className="fine-print admin-login-note">Use a phone number verified during registration or in your profile. OTP codes expire after 10 minutes.</p>
            </div>
          ) : loginMode === 'otp' && !resetToken ? (
            <div className="login-form otp-login-card">
              {!otpLogin.sent ? (
                <form onSubmit={handleStartOtpLogin}>
                  <label className="login-input-group">
                    <span className="input-icon"><Mail size={18} /></span>
                    <input name="email" type="email" required placeholder="Registered email" autoComplete="email" />
                  </label>
                  <button className="blue-submit" type="submit">Send login code</button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtpLogin}>
                  <p className="otp-destination">Enter the code sent to <strong>{otpLogin.email}</strong>.</p>
                  <label className="login-input-group">
                    <span className="input-icon"><KeyRound size={18} /></span>
                    <input
                      name="code"
                      value={otpLogin.code}
                      onChange={(event) => setOtpLogin((current) => ({ ...current, code: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      placeholder="Six-digit OTP"
                      autoComplete="one-time-code"
                      required
                    />
                  </label>
                  <button className="blue-submit" type="submit">Verify OTP and sign in</button>
                  <div className="otp-login-actions">
                    <button className="text-link-button" type="button" onClick={() => sendOtpLoginCode(otpLogin.email)}>Resend code</button>
                    <button className="text-link-button" type="button" onClick={() => { setOtpLogin({ email: '', otpToken: '', code: '', sent: false, devCode: '' }); setNotice(''); }}>Use another email</button>
                  </div>
                </form>
              )}
              {error && <p className="form-error">{error}</p>}
              {notice && <p className="success">{notice}</p>}
              <p className="fine-print admin-login-note">OTP codes expire after 10 minutes.</p>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit}>
              {!resetToken && (
                <label className="login-input-group">
                  <span className="input-icon"><Mail size={18} /></span>
                  <input name="email" type="email" required placeholder="Email" autoComplete="email" />
                </label>
              )}
              <label className="login-input-group">
                <span className="input-icon"><KeyRound size={18} /></span>
                <input name="password" type="password" required placeholder={resetToken ? 'New password' : 'Password'} autoComplete={resetToken ? 'new-password' : 'current-password'} />
              </label>
              {resetToken && (
                <label className="login-input-group">
                  <span className="input-icon"><KeyRound size={18} /></span>
                  <input name="confirmPassword" type="password" required placeholder="Confirm password" autoComplete="new-password" />
                </label>
              )}

              {!resetToken && (
                <div className="login-options">
                  <label>
                    <input name="remember" type="checkbox" />
                    Remember me
                  </label>
                  <button className="text-link-button" type="button" onClick={handleForgotPassword}>Forgot password?</button>
                </div>
              )}

              <button className="blue-submit" type="submit">{resetToken ? 'Reset password' : 'Log in'}</button>
              {error && <p className="form-error">{error}</p>}
              {notice && <p className="success">{notice}</p>}
              {!resetToken && <p className="fine-print admin-login-note">Use your registered email and password. Admin access requires a valid admin account.</p>}
            </form>
          )}

          <div className="login-footer-links">
            <Link to="/register">Create an account with password</Link>
            <Link to="/contact">Need help?</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
