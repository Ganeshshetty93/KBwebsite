import PageHero from '../components/PageHero.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const storyItems = [
  {
    title: 'Art',
    image: '/assets/about/art.png',
    text: 'Art helps children process the world around them and express their interpretations with creativity, imagination, and confidence.'
  },
  {
    title: 'Dance',
    image: '/assets/about/dance.png',
    text: 'Students are introduced to Indian dance, including film dance and classical Bharatanatya foundations.'
  },
  {
    title: 'Drama',
    image: '/assets/about/drama.png',
    text: 'Drama builds confidence, stage presence, voice, creative self-expression, and teamwork for students of all ages.'
  },
  {
    title: 'Music',
    image: '/assets/about/music.png',
    text: 'Students can learn and embrace music through Hindustani, Carnatic, and devotional traditions for different age groups.'
  },
  {
    title: 'Yoga',
    image: '/assets/about/yoga.png',
    text: 'Yoga builds a sturdy foundation through guided practice, flexibility, balance, and mindful movement.'
  }
];

export default function About() {
  const { t } = useLanguage();

  return (
    <>
      <PageHero
        eyebrow={t('aboutEyebrow')}
        title={t('aboutTitle')}
        text={t('aboutText')}
        className="about-hero"
      />
      <section className="section two-column">
        <div>
          <h2>{t('mission')}</h2>
          <p>{t('missionText')}</p>
        </div>
        <div className="info-stack">
          <article>
            <h3>{t('language')}</h3>
            <p>Kannada Paata Shaale helps children build confidence in reading, writing, and speaking Kannada.</p>
          </article>
          <article>
            <h3>{t('community')}</h3>
            <p>Volunteer-led events create a shared place for celebration, service, and belonging.</p>
          </article>
        </div>
      </section>

      <section className="section about-story-section">
        <div className="about-story-heading">
          <p className="eyebrow">Programs</p>
          <h2>Explore arts and traditions across every generation</h2>
          <p>Being away from Karnataka does not stop us from staying rooted in our culture.</p>
        </div>

        <div className="about-story">
          {storyItems.map((item, index) => (
            <article className="story-item" key={item.title}>
              <div className="story-copy">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
              <div className="story-marker">
                <img src={item.image} alt={`${item.title} program`} />
              </div>
            </article>
          ))}
          <div className="story-end">
            <span>Be part<br />of our<br />story.</span>
          </div>
        </div>
      </section>
    </>
  );
}
