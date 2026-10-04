import { Award, BookOpenText, ExternalLink, Feather, Landmark, LibraryBig, Sparkles } from 'lucide-react';

const eras = [
  {
    period: 'Old Kannada',
    title: 'Inscriptions, kingdoms, and classical poetics',
    text: 'Old Kannada developed through inscriptions, courtly culture, Jain scholarship, and royal patronage. Kavirajamarga is often treated as an early landmark for Kannada literary theory and taste.'
  },
  {
    period: 'Jain classics',
    title: 'Champu, epics, and the age of the three gems',
    text: 'Writers such as Pampa, Ponna, and Ranna helped shape classical Kannada through sophisticated poetry, epic retellings, and the champu style that mixed prose and verse.'
  },
  {
    period: 'Middle Kannada',
    title: 'Vachanas, Veerashaiva thought, and Haridasa music',
    text: 'The Vachana movement brought direct spiritual expression into everyday Kannada, while later devotional currents such as the Haridasa tradition connected poetry, music, ethics, and bhakti.'
  },
  {
    period: 'Modern Kannada',
    title: 'Navodaya, Navya, prose, theatre, and world recognition',
    text: 'Modern Kannada literature expanded through novels, short stories, drama, essays, criticism, and new poetic movements. Its writers have received national and international recognition.'
  }
];

const writers = [
  'Pampa',
  'Ponna',
  'Ranna',
  'Basavanna',
  'Akka Mahadevi',
  'Purandara Dasa',
  'Kanaka Dasa',
  'Kuvempu',
  'D. R. Bendre',
  'Shivaram Karanth',
  'Masti Venkatesha Iyengar',
  'U. R. Ananthamurthy',
  'Girish Karnad',
  'Chandrashekhara Kambara',
  'B. V. Karanth',
  'Vaidehi',
  'Vivek Shanbhag'
];

const pillars = [
  ['Language', 'Kannada preserves memory, family stories, local wisdom, scholarship, devotional expression, and community identity.'],
  ['History', 'Karnataka history includes dynasties, inscriptions, temples, mathas, reform movements, trade, music, and cultural exchange.'],
  ['Literature', 'Kannada literature moves from classical poetics and Jain epics to vachanas, devotional music, modern fiction, theatre, and criticism.']
];

const movements = [
  ['Jain literary tradition', 'Court poetry, epic retellings, grammar, poetics, and champu writing gave Kannada a powerful classical foundation.'],
  ['Veerashaiva and Vachana writing', 'Basavanna, Akka Mahadevi, Allama Prabhu, and other sharanas used direct Kannada to express spiritual and social thought.'],
  ['Vaishnava and Haridasa tradition', 'Composers such as Purandara Dasa and Kanaka Dasa carried devotional philosophy through music and accessible Kannada.'],
  ['Modern movements', 'Navodaya, Navya, Bandaya, Dalit writing, theatre, and contemporary fiction continue to reshape Kannada public life.']
];

const recognitions = [
  ['Classical Language', 'Kannada is recognized as one of India\'s classical languages.'],
  ['Jnanpith Awards', 'Kannada has a remarkable Jnanpith presence through writers such as Kuvempu, Bendre, Karanth, Masti, Ananthamurthy, Karnad, and Kambara.'],
  ['International Booker', 'In 2025, Banu Mushtaq\'s Heart Lamp brought Kannada short fiction into the International Booker spotlight.'],
  ['Sahitya Akademi', 'Kannada authors have been consistently recognized by the Sahitya Akademi across poetry, fiction, criticism, and drama.']
];

export default function KannadaLiterature() {
  return (
    <>
      <section className="literature-hero">
        <div>
          <p className="eyebrow">Kannada Literature</p>
          <h1>History of Karnataka and the living world of Kannada literature</h1>
          <p>
            Explore the journey of Kannada through kingdoms, inscriptions, poetry, vachanas,
            modern writing, and the cultural imagination of Karnataka.
          </p>
        </div>
        <div className="literature-hero-card" aria-label="Kannada literature highlights">
          <BookOpenText size={34} />
          <strong>ಕನ್ನಡ ಸಾಹಿತ್ಯ</strong>
          <span>Classical roots. Modern voice. Living culture.</span>
        </div>
      </section>

      <section className="section literature-pillars">
        {pillars.map(([title, text], index) => {
          const Icon = index === 0 ? Feather : index === 1 ? Landmark : LibraryBig;
          return (
            <article key={title}>
              <Icon size={24} />
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          );
        })}
      </section>

      <section className="section literature-timeline-section">
        <div className="literature-section-heading">
          <p className="eyebrow">Timeline</p>
          <h2>Kannada literature across eras</h2>
          <p>From early records and classical court works to devotional movements and modern literature.</p>
        </div>
        <div className="literature-timeline">
          {eras.map((era) => (
            <article key={era.period}>
              <span>{era.period}</span>
              <h3>{era.title}</h3>
              <p>{era.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section literature-movement-section">
        <div className="literature-section-heading">
          <p className="eyebrow">Traditions</p>
          <h2>Major streams of Kannada writing</h2>
          <p>Kannada literature is not one single style; it is a layered conversation across faith, region, caste, court, folk life, music, and modern public thought.</p>
        </div>
        <div className="literature-movement-grid">
          {movements.map(([title, text]) => (
            <article key={title}>
              <BookOpenText size={22} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section literature-writers-section">
        <div className="literature-section-heading">
          <p className="eyebrow">Writers</p>
          <h2>Names every Kannada learner should recognize</h2>
          <p>These names represent only a small doorway into the richness of Kannada literary tradition.</p>
        </div>
        <div className="literature-writer-cloud">
          {writers.map((writer) => (
            <span key={writer}><Award size={16} /> {writer}</span>
          ))}
        </div>
      </section>

      <section className="section literature-recognition-section">
        <div className="literature-section-heading">
          <p className="eyebrow">Recognition</p>
          <h2>Why Kannada literature matters nationally and globally</h2>
          <p>Its range is visible in classical status, literary awards, translations, theatre, and the continued life of Kannada in homes and classrooms.</p>
        </div>
        <div className="literature-recognition-grid">
          {recognitions.map(([title, text]) => (
            <article key={title}>
              <Award size={22} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section literature-closing">
        <Sparkles size={28} />
        <h2>Kannada is more than a language</h2>
        <p>
          It is memory, music, argument, devotion, humour, scholarship, and the everyday voice of Karnataka.
          Reading Kannada literature helps the next generation feel connected to both history and home.
        </p>
        <a href="https://en.wikipedia.org/wiki/Kannada_literature" target="_blank" rel="noreferrer">
          Reference: Kannada literature overview <ExternalLink size={15} />
        </a>
      </section>
    </>
  );
}
