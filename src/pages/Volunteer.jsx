import PageHero from '../components/PageHero.jsx';
import FormPanel from '../components/FormPanel.jsx';
import { volunteerAreas } from '../data/siteData.js';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Volunteer() {
  const { t } = useLanguage();

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
    </>
  );
}
