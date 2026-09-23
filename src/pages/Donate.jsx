import { useState } from 'react';
import PageHero from '../components/PageHero.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { appendRecord } from '../utils/storage.js';

const amounts = [50, 80, 100, 250];

export default function Donate() {
  const [selected, setSelected] = useState(80);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const { t } = useLanguage();

  function handleDonate(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const amount = custom || selected;
    appendRecord('kb-donation-submissions', { ...payload, amount: Number(amount) });
    event.currentTarget.reset();
    setCustom('');
    setSelected(80);
    setMessage(`Donation saved for $${amount}.`);
  }

  return (
    <>
      <PageHero
        eyebrow={t('donateEyebrow')}
        title={t('donateTitle')}
        text={t('donateText')}
        className="donate-hero"
      />
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
        <form className="donation-panel" onSubmit={handleDonate}>
          <label>
            {t('donationName')}
            <input name="name" placeholder="Your name" required />
          </label>
          <label>
            {t('email')}
            <input name="email" type="email" placeholder="you@example.com" required />
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
            <input value={custom} onChange={(event) => setCustom(event.target.value)} type="number" min="1" placeholder="Enter amount" />
          </label>
          <button className="button primary" type="submit">{t('continueDonation')}</button>
          {message && <p className="success">{message}</p>}
        </form>
      </section>
    </>
  );
}
