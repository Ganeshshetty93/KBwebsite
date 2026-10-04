import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import FormPanel from '../components/FormPanel.jsx';
import { volunteerAreas } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { readJson } from '../utils/storage.js';
import { apiReadSiteSetting } from '../utils/api.js';

const defaultVolunteerGoogleForm = {
  enabled: false,
  url: 'https://docs.google.com/forms/d/e/1FAIpQLSc1etxiGQgKR7XKhpSBd5UuLR-9-_0KDmxg7Zxd98RXK1w2Kg/viewform?embedded=true'
};

function normalizeGoogleForm(setting = defaultVolunteerGoogleForm) {
  return {
    enabled: setting.enabled === true || setting.enabled === 'true' || setting.enabled === 'Yes' || setting.enabled === 1,
    url: String(setting.url || defaultVolunteerGoogleForm.url).trim()
  };
}

function googleFormEmbedUrl(url) {
  if (!url) return '';
  const separator = url.includes('?') ? '&' : '?';
  return url.includes('embedded=true') ? url : `${url}${separator}embedded=true`;
}

export default function Volunteer() {
  const { t } = useLanguage();
  const [googleForm, setGoogleForm] = useState(() => normalizeGoogleForm(readJson('kb-volunteer-google-form', defaultVolunteerGoogleForm)));
  const [showGoogleForm, setShowGoogleForm] = useState(false);
  const isGoogleFormEnabled = Boolean(googleForm.enabled && googleForm.url);
  const embedUrl = googleFormEmbedUrl(googleForm.url);

  useEffect(() => {
    let ignore = false;
    apiReadSiteSetting('volunteer-google-form')
      .then((setting) => {
        if (ignore) return;
        const normalized = normalizeGoogleForm(setting || defaultVolunteerGoogleForm);
        setGoogleForm(normalized);
      })
      .catch(() => {});

    function syncSettings() {
      setGoogleForm(normalizeGoogleForm(readJson('kb-volunteer-google-form', defaultVolunteerGoogleForm)));
    }

    window.addEventListener('kb-data-change', syncSettings);
    window.addEventListener('storage', syncSettings);
    return () => {
      ignore = true;
      window.removeEventListener('kb-data-change', syncSettings);
      window.removeEventListener('storage', syncSettings);
    };
  }, []);

  return (
    <>
      <PageHero
        eyebrow={t('navVolunteer')}
        title={t('volunteerTitle')}
        text={t('volunteerText')}
        className="volunteer-hero"
        />
      <section className="section two-column">
        <div>
          <h2>{t('waysToHelp')}</h2>
          <div className="tag-cloud">
            {volunteerAreas.map((area) => <span key={area}>{area}</span>)}
          </div>
          <article className="volunteer-google-card">
            <p className="eyebrow">Volunteer Registration</p>
            <h3>Google Form registration</h3>
            <p>Admins can enable a Google Form for formal volunteer registration. When it is not enabled, the registration action remains unavailable.</p>
            {isGoogleFormEnabled ? (
              <button className="button primary" type="button" onClick={() => setShowGoogleForm(true)}>Open Google Form</button>
            ) : (
              <button className="button primary" type="button" disabled>Google Form Disabled</button>
            )}
          </article>
        </div>
        <FormPanel
          type="volunteer"
          submitLabel="Send Volunteer Interest"
          fields={[
            { name: 'name', label: 'Name', required: true, placeholder: 'Your name' },
            { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@example.com' },
            { name: 'interest', label: 'Volunteer interest', type: 'select', required: true, options: volunteerAreas },
            { name: 'message', label: 'Message', type: 'textarea', placeholder: 'Tell us how you would like to help' }
          ]}
        />
      </section>
      {showGoogleForm && isGoogleFormEnabled && (
        <div className="popup-backdrop volunteer-form-backdrop" role="presentation" onClick={() => setShowGoogleForm(false)}>
          <div
            className="popup-panel volunteer-form-popup"
            role="dialog"
            aria-modal="true"
            aria-label="Volunteer Google Form registration"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="popup-close" type="button" aria-label="Close Google Form" onClick={() => setShowGoogleForm(false)}>
              <X size={20} />
            </button>
            <div className="google-form-frame-wrap">
              <iframe
                title="Kannada Bharati volunteer Google Form"
                src={embedUrl}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
