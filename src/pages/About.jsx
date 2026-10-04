import { useEffect, useMemo, useState } from 'react';
import { Award, HeartHandshake, Mail, Phone, Sparkles, UsersRound } from 'lucide-react';
import PageHero from '../components/PageHero.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { apiReadSiteSetting } from '../utils/api.js';
import { defaultAboutContent, normalizeAboutContent } from '../utils/aboutContent.js';
import { readJson, writeJson } from '../utils/storage.js';

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

function AutoSlideTrack({ className, items, renderItem }) {
  const repeatedItems = [...items, ...items];
  return (
    <div className="about-auto-scroll">
      <div className={`${className} about-auto-track`} aria-live="off">
        {repeatedItems.map((item, index) => renderItem(item, `${item.id || item.name || item.title || index}-${index}`))}
      </div>
    </div>
  );
}

export default function About() {
  const { t } = useLanguage();
  const [aboutContent, setAboutContent] = useState(() => normalizeAboutContent(readJson('kb-about-content', defaultAboutContent)));
  const [activeSection, setActiveSection] = useState('currentCommittee');
  const committeeCount = aboutContent.currentCommittee.length;
  const sponsorCount = aboutContent.sponsors.length;
  const pastCount = aboutContent.pastCommittees.length;
  const highlights = useMemo(() => [
    { label: 'Committee members', value: committeeCount, icon: UsersRound },
    { label: 'Sponsors', value: sponsorCount, icon: HeartHandshake },
    { label: 'Past committees', value: pastCount, icon: Award }
  ], [committeeCount, pastCount, sponsorCount]);
  const sectionTabs = useMemo(() => [
    { key: 'currentCommittee', label: 'Current Committee', count: committeeCount, icon: UsersRound },
    { key: 'sponsors', label: 'Our Sponsors', count: sponsorCount, icon: HeartHandshake },
    { key: 'pastCommittees', label: 'Past Committees', count: pastCount, icon: Award }
  ], [committeeCount, pastCount, sponsorCount]);

  useEffect(() => {
    let ignore = false;
    apiReadSiteSetting('about-content')
      .then((setting) => {
        if (ignore) return;
        const normalized = normalizeAboutContent(setting);
        setAboutContent(normalized);
        writeJson('kb-about-content', normalized);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

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

      <section className="section about-leadership-section" aria-labelledby="about-leadership-title">
        <div className="about-leadership-heading">
          <p className="eyebrow">About Us</p>
          <h2 id="about-leadership-title">People powering Kannada Bharati</h2>
          <p>Meet the current committee, sponsors, and the past teams whose service keeps classes, cultural programs, and community events moving forward.</p>
          <div className="about-highlight-row">
            {highlights.map(({ label, value, icon: Icon }) => (
              <article key={label}>
                <Icon size={20} />
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="about-anchor-tabs" role="tablist" aria-label="About sections">
          {sectionTabs.map(({ key, label, count, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeSection === key}
              className={activeSection === key ? 'is-active' : ''}
              onClick={() => setActiveSection(key)}
            >
              <Icon size={17} />
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </div>

        {activeSection === 'currentCommittee' && <div id="current-committee" className="about-directory-block active-about-panel" role="tabpanel">
          <div className="about-directory-title">
            <span><UsersRound size={18} /> Current Committee</span>
            <strong>{committeeCount}</strong>
          </div>
          <AutoSlideTrack
            className="committee-grid"
            items={aboutContent.currentCommittee}
            renderItem={(member, key) => (
              <article className="committee-card" key={key}>
                <div className="committee-photo">
                  {member.photo ? <img src={member.photo} alt={member.name} /> : <UsersRound size={34} />}
                </div>
                <div>
                  <span>{member.role || 'Committee Member'}</span>
                  <h3>{member.name}</h3>
                  {member.bio && <p>{member.bio}</p>}
                  <div className="committee-contact">
                    {member.email && <a href={`mailto:${member.email}`}><Mail size={15} /> {member.email}</a>}
                    {member.phone && <a href={`tel:${member.phone}`}><Phone size={15} /> {member.phone}</a>}
                  </div>
                </div>
              </article>
            )}
          />
        </div>}

        {activeSection === 'sponsors' && <div id="our-sponsors" className="about-directory-block sponsor-block active-about-panel" role="tabpanel">
          <div className="about-directory-title">
            <span><HeartHandshake size={18} /> Our Sponsors</span>
            <strong>{sponsorCount}</strong>
          </div>
          <AutoSlideTrack
            className="sponsor-grid"
            items={aboutContent.sponsors}
            renderItem={(sponsor, key) => (
              <article className="sponsor-card" key={key}>
                <div className="sponsor-logo">
                  {sponsor.photo ? <img src={sponsor.photo} alt={sponsor.name} /> : <Sparkles size={30} />}
                </div>
                <div>
                  <span>{sponsor.level || 'Sponsor'}</span>
                  <h3>{sponsor.name}</h3>
                  {sponsor.note && <p>{sponsor.note}</p>}
                  {sponsor.website && <a href={sponsor.website} target="_blank" rel="noreferrer">Visit sponsor</a>}
                </div>
              </article>
            )}
          />
        </div>}

        {activeSection === 'pastCommittees' && <div id="past-committees" className="about-directory-block active-about-panel" role="tabpanel">
          <div className="about-directory-title">
            <span><Award size={18} /> Past Committees</span>
            <strong>{pastCount}</strong>
          </div>
          <AutoSlideTrack
            className="past-committee-grid"
            items={aboutContent.pastCommittees}
            renderItem={(committee, key) => (
              <article className="past-committee-card" key={key}>
                <div className="past-committee-image">
                  {committee.photo ? <img src={committee.photo} alt={committee.title || committee.term} /> : <Award size={32} />}
                </div>
                <div>
                  <span>{committee.term || 'Past Committee'}</span>
                  <h3>{committee.title || 'Committee team'}</h3>
                  {committee.members && <p>{committee.members}</p>}
                </div>
              </article>
            )}
          />
        </div>}
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
