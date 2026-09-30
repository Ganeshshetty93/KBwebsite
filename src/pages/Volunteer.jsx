import { useEffect, useState } from 'react';
import PageHero from '../components/PageHero.jsx';
import FormPanel from '../components/FormPanel.jsx';
import { volunteerAreas } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { readJson } from '../utils/storage.js';
import { apiReadSiteSetting } from '../utils/api.js';

const defaultVolunteerGoogleForm = {
  enabled: false,
  url: ''
};

function googleFormEmbedUrl(url) {
  if (!url) return '';
  const separator = url.includes('?') ? '&' : '?';
  return url.includes('embedded=true') ? url : `${url}${separator}embedded=true`;
}

export default function Volunteer() {
  const { t } = useLanguage();
  const [googleForm, setGoogleForm] = useState(() => readJson('kb-volunteer-google-form', defaultVolunteerGoogleForm));
  const isGoogleFormEnabled = Boolean(googleForm.enabled && googleForm.url);
  const embedUrl = googleFormEmbedUrl(googleForm.url);

  useEffect(() => {
    let ignore = false;
    apiReadSiteSetting('volunteer-google-form')
      .then((setting) => {
        if (!ignore) setGoogleForm(setting || defaultVolunteerGoogleForm);
      })
      .catch(() => {});

    function syncSettings() {
      setGoogleForm(readJson('kb-volunteer-google-form', defaultVolunteerGoogleForm));
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
              <a className="button primary" href={googleForm.url} target="_blank" rel="noreferrer">Open Google Form</a>
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
      <section className="section volunteer-google-section">
        <div className="section-heading">
          <p className="eyebrow">Registration</p>
          <h2>Volunteer Registration</h2>
        </div>
        {isGoogleFormEnabled ? (
          <div className="google-form-frame-wrap">
            <iframe
              title="Kannada Bharati volunteer Google Form"
              src={embedUrl}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="google-form-disabled">
            <h3>Google Form registration is currently disabled.</h3>
            <p>Please use the volunteer interest form above or check back after registration is opened.</p>
            <button className="button primary" type="button" disabled>Google Form Disabled</button>
          </div>
        )}
      </section>
    </>
  );
}
