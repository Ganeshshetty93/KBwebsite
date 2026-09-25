import { useState } from 'react';
import { CalendarDays, Clock, MapPin, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { appendRecord } from '../utils/storage.js';
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

export default function ClassCard({ item }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestError, setGuestError] = useState('');
  const [guestSaved, setGuestSaved] = useState(false);
  const classImage = getClassImage(item);
  const registerUrl = `/register?program=${encodeURIComponent(item.title)}`;
  const feeText = getFeeText(item);

  function handleGuestSubmit(event) {
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

    appendRecord('kb-registration-submissions', {
      parentName: `${firstName} ${lastName}`.trim(),
      studentName: cleanText(payload.studentName) || `${firstName} ${lastName}`.trim(),
      email,
      phone: phone || '-',
      program: item.title,
      status: 'Guest submitted',
      fee: feeText
    });

    event.currentTarget.reset();
    setGuestSaved(true);
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
        <button className="button compact" type="button" onClick={() => setShowDetails(true)}>
          Details
        </button>
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
              <h3>Class Registration Process:</h3>
              <ol>
                <li>Submit Registration</li>
                <li>Wait for <strong>Approved</strong> email as confirmation</li>
                <li>After receiving Approved email, <strong>donate</strong> {feeText}</li>
                <li>Receive payment confirmation as proof of registration</li>
              </ol>
            </section>
            <div className="class-detail-actions">
              <Link className="button primary" to={registerUrl}>Register</Link>
              <button className="button primary" type="button" onClick={() => { setShowGuestForm((value) => !value); setGuestError(''); }}>
                Register as Guest
              </button>
            </div>
            {showGuestForm && (
              <form className="guest-registration-form" onSubmit={handleGuestSubmit}>
                <h3>Guest Registration</h3>
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
                {guestSaved && <p className="success">Guest registration submitted. Please wait for approved email confirmation.</p>}
                <button className="button primary" type="submit">Submit Registration</button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
