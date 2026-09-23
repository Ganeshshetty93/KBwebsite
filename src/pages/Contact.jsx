import PageHero from '../components/PageHero.jsx';
import FormPanel from '../components/FormPanel.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Contact() {
  const { t } = useLanguage();

  return (
    <>
      <PageHero
        eyebrow={t('navContact')}
        title={t('contactTitle')}
        text={t('contactText')}
        className="contact-hero"
      />
      <section className="section two-column">
        <div className="contact-card">
          <h2>{t('contactDetails')}</h2>
          <p><strong>Email:</strong> <a href="mailto:kannada@kannadabharati.org">kannada@kannadabharati.org</a></p>
          <p><strong>Class location:</strong> Cross of Christ Lutheran Church, 411 156th Ave NE, Bellevue, WA 98007.</p>
          <p><strong>Online classes:</strong> Paata Shaale meets through Virtual Google Classroom.</p>
        </div>
        <FormPanel
          type="contact"
          submitLabel={t('sendMessage')}
          fields={[
            { name: 'name', label: 'Name', required: true, placeholder: 'Your name' },
            { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@example.com' },
            { name: 'topic', label: 'Topic', type: 'select', required: true, options: ['Classes', 'Paata Shaale', 'Events', 'Donation', 'Volunteering', 'Other'] },
            { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'How can we help?' }
          ]}
        />
      </section>
    </>
  );
}
