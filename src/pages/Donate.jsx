import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, HeartPulse, HandHeart, Landmark, ShieldAlert, UsersRound } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { appendRecord, readJson } from '../utils/storage.js';
import { apiReadRecords } from '../utils/api.js';
import { cleanText, firstError, validateAmount, validateEmail, validateRequired } from '../utils/validation.js';

const amounts = [50, 80, 100, 250];
const paypalHostedButtonId = 'EY5YVURQPDWEE';
const defaultFundraiser = {
  id: 'default-kb-paata-shaale',
  title: 'KB Paata Shaale',
  category: 'Education',
  beneficiary: 'Kannada Bharati students',
  purpose: 'Support Kannada language learning, books, curriculum, online classroom tools, and student program access.',
  goal: 5000,
  raised: 0,
  deadline: '2027-06-30',
  status: 'Active',
  photo: ''
};

const causeIcons = {
  Education: BookOpen,
  Health: HeartPulse,
  Emergency: ShieldAlert,
  Community: UsersRound,
  Memorial: Landmark,
  Other: HandHeart
};

function withDefaultFundraiser(records) {
  const activeRecords = Array.isArray(records) ? records : [];
  if (activeRecords.some((record) => record.id === defaultFundraiser.id || record.title === defaultFundraiser.title)) {
    return activeRecords;
  }

  return [defaultFundraiser, ...activeRecords];
}

function paypalDonateUrl(amount, causeTitle) {
  const params = new URLSearchParams({
    hosted_button_id: paypalHostedButtonId,
    amount: amount.toFixed(2),
    currency_code: 'USD',
    item_name: causeTitle || 'Kannada Bharati Donation'
  });

  return `https://www.paypal.com/donate?${params.toString()}`;
}

export default function Donate() {
  const [selected, setSelected] = useState(80);
  const [custom, setCustom] = useState('');
  const [fundraisers, setFundraisers] = useState(() => withDefaultFundraiser(readJson('kb-admin-fundraisers', [])));
  const [selectedCause, setSelectedCause] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const donationFormRef = useRef(null);
  const { language, t } = useLanguage();
  const causes = useMemo(() => fundraisers.filter((cause) => cause.status !== 'Completed'), [fundraisers]);
  const publicFundraisers = useMemo(() => causes.filter((cause) => cause.id !== defaultFundraiser.id), [causes]);
  const selectedCauseRecord = causes.find((item) => item.id === selectedCause) || causes[0];

  useEffect(() => {
    let ignore = false;
    apiReadRecords('kb-admin-fundraisers')
      .then((records) => {
        if (!ignore) {
          const fallbackRecords = readJson('kb-admin-fundraisers', []);
          const nextRecords = withDefaultFundraiser(records.length ? records : fallbackRecords);
          setFundraisers(nextRecords);
          if (!selectedCause && nextRecords.length) {
            setSelectedCause(nextRecords[0].id);
          }
        }
      })
      .catch(() => {
        const records = withDefaultFundraiser(readJson('kb-admin-fundraisers', []));
        if (!ignore) {
          setFundraisers(records);
          if (!selectedCause && records.length) {
            setSelectedCause(records[0].id);
          }
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedCause]);

  function handleDonate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const amount = Number(custom || selected);
    setMessage('');
    setError('');
    const validationError = firstError([
      validateRequired(payload.name, 'Name'),
      validateEmail(payload.email),
      validateRequired(payload.causeId, 'Donation cause'),
      validateAmount(amount, 'Donation amount', { min: 1 })
    ]);

    if (validationError) {
      setError(validationError);
      return;
    }

    const cause = selectedCauseRecord;
    if (!cause) {
      setError(language === 'kn' ? 'ದಯವಿಟ್ಟು ದೇಣಿಗೆ ಉದ್ದೇಶವನ್ನು ಆಯ್ಕೆಮಾಡಿ.' : 'Please select a fundraising cause.');
      return;
    }

    appendRecord('kb-donation-submissions', {
      ...Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, cleanText(value)])),
      causeId: cause.id,
      cause: cause?.title || selectedCause,
      paymentStatus: 'PayPal opened',
      amount
    });

    setMessage(language === 'kn' ? `PayPal ಗೆ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ: $${amount}.` : `Opening PayPal for $${amount}.`);
    window.location.assign(paypalDonateUrl(amount, cause?.title));

    form.reset();
    setCustom('');
  }

  function chooseCause(causeId) {
    setSelectedCause(causeId);
    donationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <>
      <PageHero
        eyebrow={t('donateEyebrow')}
        title={t('donateTitle')}
        text={t('donateText')}
        className="donate-hero"
      />
      <section className="section fundraising-section">
        <div className="section-toolbar">
          <div>
            <p className="eyebrow">{language === 'kn' ? 'ನಿಧಿ ಸಂಗ್ರಹ' : 'Fund raising'}</p>
            <h2>{language === 'kn' ? 'ನಿಮ್ಮ ದೇಣಿಗೆ ಯಾವ ಉದ್ದೇಶಕ್ಕೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ' : 'Choose the cause your donation supports'}</h2>
          </div>
          <p>
            {language === 'kn'
              ? 'ನಿರ್ವಾಹಕರು ಶಿಕ್ಷಣ, ಆರೋಗ್ಯ ಅಥವಾ ತುರ್ತು ಅಗತ್ಯಗಳಿಗೆ ನಿಧಿ ಸಂಗ್ರಹ ಆರಂಭಿಸಿದಾಗ ಇಲ್ಲಿ ಕಾಣುತ್ತದೆ.'
              : 'Admin-created education, health, emergency, and community causes appear here for direct donation.'}
          </p>
        </div>
        {publicFundraisers.length === 0 ? (
          <div className="empty-fundraising">
            <strong>{language === 'kn' ? 'ಈಗ ಯಾವುದೇ ನಿಧಿ ಸಂಗ್ರಹ ಇಲ್ಲ.' : 'No active fundraising causes yet.'}</strong>
            <span>{language === 'kn' ? 'ನಿರ್ವಾಹಕರು ಹೊಸ cause ಸೇರಿಸಿದ ನಂತರ ಅದು ಇಲ್ಲಿ ಕಾಣುತ್ತದೆ.' : 'When admin adds a new cause, it will appear here for donation.'}</span>
          </div>
        ) : (
          <div className="fundraising-grid">
            {publicFundraisers.map((cause, index) => {
              const Icon = causeIcons[cause.category] || HandHeart;
              const progress = cause.goal > 0 ? Math.min(Math.round((cause.raised / cause.goal) * 100), 100) : 0;

              return (
                <button
                  className={`fundraising-card ${selectedCauseRecord?.id === cause.id ? 'is-active' : ''}`}
                  key={cause.id || cause.title}
                  onClick={() => chooseCause(cause.id)}
                  style={{ '--delay': `${index * 80}ms`, '--progress': `${progress}%` }}
                  type="button"
                >
                  {cause.photo && <img className="fundraising-photo" src={cause.photo} alt={cause.title} />}
                  <span className="fundraising-icon"><Icon size={22} /></span>
                  <small className="fundraising-category">{cause.category || 'Cause'}</small>
                  <strong>{cause.title}</strong>
                  {cause.beneficiary && <em>For {cause.beneficiary}</em>}
                  <span>{cause.purpose}</span>
                  <span className="fundraising-progress" aria-label={`${progress}% raised`}>
                    <span />
                  </span>
                  <small>${Number(cause.raised || 0).toLocaleString()} raised of ${Number(cause.goal || 0).toLocaleString()}</small>
                  {cause.deadline && <small>Needed by {new Date(`${cause.deadline}T00:00:00`).toLocaleDateString()}</small>}
                </button>
              );
            })}
          </div>
        )}
      </section>
      <section className="section two-column">
        <div>
          <h2>{t('supportHelps')}</h2>
          <ul className="check-list">
            <li>Kannada language education</li>
            <li>Classroom and venue costs</li>
            <li>Community events and performances</li>
            <li>Student showcases and volunteer operations</li>
          </ul>
        </div>
        <form className="donation-panel" onSubmit={handleDonate} ref={donationFormRef}>
          <label>
            {t('donationName')}
            <input name="name" placeholder="Your name" required />
          </label>
          <label>
            {t('email')}
            <input name="email" type="email" placeholder="you@example.com" required />
          </label>
          <label>
            {language === 'kn' ? 'ದೇಣಿಗೆ ಉದ್ದೇಶ' : 'Donation cause'}
            <select name="causeId" value={selectedCauseRecord?.id || ''} onChange={(event) => setSelectedCause(event.target.value)} required>
              <option value="" disabled>{language === 'kn' ? 'ಉದ್ದೇಶ ಆಯ್ಕೆಮಾಡಿ' : 'Select a cause'}</option>
              {causes.map((cause) => (
                <option key={cause.id} value={cause.id}>{cause.title}</option>
              ))}
            </select>
          </label>
          <div className="amount-row">
            {amounts.map((amount) => (
              <button
                key={amount}
                type="button"
                className={selected === amount && !custom ? 'is-selected' : ''}
                onClick={() => {
                  setSelected(amount);
                  setCustom('');
                }}
              >
                ${amount}
              </button>
            ))}
          </div>
          <label>
            {t('donationAmount')}
            <input
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              type="number"
              min="1"
              step="1"
              placeholder="Enter amount"
            />
          </label>
          <button className="button primary" type="submit">{t('continueDonation')}</button>
          {error && <p className="form-error">{error}</p>}
          {message && <p className="success">{message}</p>}
        </form>
      </section>
    </>
  );
}
