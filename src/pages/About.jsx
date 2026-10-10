import { useEffect, useMemo, useState } from 'react';
import { Award, ChevronLeft, ChevronRight, HeartHandshake, Mail, Pause, Phone, Play, Sparkles, UsersRound } from 'lucide-react';
import PageHeroCarousel from '../components/EventHeroCarousel.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { apiReadAboutContent } from '../utils/api.js';
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

const sponsorShowcaseSlides = [
  { id: 'about-education-partners', name: 'Education Partners', level: 'Paata Shaale', note: 'Supporting Kannada learning and student programs.', shortLabel: 'EDU', accent: '#e5a51b', softAccent: '#fff0bd' },
  { id: 'about-cultural-partners', name: 'Cultural Partners', level: 'Arts and Events', note: 'Helping bring music, dance, theatre, and traditions to the community.', shortLabel: 'ART', accent: '#c41230', softAccent: '#ffd9df' },
  { id: 'about-community-partners', name: 'Community Partners', level: 'Local Support', note: 'Working with volunteers and families to strengthen our programs.', shortLabel: 'COMM', accent: '#08736b', softAccent: '#cdeee8' },
  { id: 'about-sponsor-invitation', name: 'Become a Sponsor', level: 'Partner With Us', note: 'Support language, arts, education, and cultural experiences.', shortLabel: 'JOIN', accent: '#7447a8', softAccent: '#eadcff' }
];

function AboutCoverFlow({ items, label, className = '', renderItem, onActivate }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const move = (direction) => {
    if (!items.length) return;
    setActiveIndex((current) => (current + direction + items.length) % items.length);
  };

  useEffect(() => {
    if (isPaused || isInteracting || items.length < 2) return undefined;
    const timer = window.setInterval(() => move(1), 4400);
    return () => window.clearInterval(timer);
  }, [isPaused, isInteracting, items.length]);

  useEffect(() => {
    if (activeIndex < items.length) return;
    setActiveIndex(0);
  }, [activeIndex, items.length]);

  if (!items.length) return null;

  const offsetFromActive = (index) => {
    let offset = index - activeIndex;
    const halfway = items.length / 2;
    if (offset > halfway) offset -= items.length;
    if (offset < -halfway) offset += items.length;
    return offset;
  };

  return (
    <div
      className={`about-cover-flow ${className}`.trim()}
      aria-label={label}
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocus={() => setIsInteracting(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsInteracting(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') move(-1);
        if (event.key === 'ArrowRight') move(1);
      }}
    >
      <div className="about-cover-stage">
        {items.map((item, index) => {
          const offset = offsetFromActive(index);
          const distance = Math.abs(offset);
          const isActive = index === activeIndex;
          return (
            <div
              className={`about-cover-item${isActive ? ' is-active' : ''}${distance > 3 ? ' is-hidden' : ''}`}
              key={item.id || `${item.name || item.title || label}-${index}`}
              onClickCapture={(event) => {
                if (isActive) return;
                event.preventDefault();
                event.stopPropagation();
                setActiveIndex(index);
              }}
              onDoubleClick={() => isActive && onActivate?.(item)}
              style={{
                '--cover-offset': offset,
                '--cover-distance': distance,
                '--about-accent': item.accent || '#e5a51b',
                '--about-soft-accent': item.softAccent || '#fff3ce',
                zIndex: items.length - distance
              }}
            >
              {renderItem(item, isActive)}
            </div>
          );
        })}
      </div>
      {items.length > 1 && (
        <div className="about-cover-controls" aria-label={`${label} controls`}>
          <button type="button" onClick={() => move(-1)} aria-label="Previous slide"><ChevronLeft size={20} /></button>
          <div className="about-cover-dots" role="tablist" aria-label={`Choose ${label} slide`}>
            {items.map((item, index) => (
              <button
                className={index === activeIndex ? 'is-active' : ''}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`Show ${item.name || item.title || `slide ${index + 1}`}`}
                key={item.id || `about-dot-${index}`}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
          <button type="button" onClick={() => setIsPaused((current) => !current)} aria-label={isPaused ? 'Play carousel' : 'Pause carousel'}>
            {isPaused ? <Play size={17} /> : <Pause size={17} />}
          </button>
          <button type="button" onClick={() => move(1)} aria-label="Next slide"><ChevronRight size={20} /></button>
        </div>
      )}
    </div>
  );
}

export default function About() {
  const { t } = useLanguage();
  const [aboutContent, setAboutContent] = useState(() => normalizeAboutContent(readJson('kb-about-content', defaultAboutContent)));
  const [activeSection, setActiveSection] = useState('currentCommittee');
  const [activeSponsor, setActiveSponsor] = useState(null);
  const committeeSlides = [...aboutContent.currentCommittee, ...defaultAboutContent.currentCommittee]
    .filter((member, index, rows) => rows.findIndex((row) => row.id === member.id) === index)
    .slice(0, Math.max(3, aboutContent.currentCommittee.length));
  const sponsorSlides = [...aboutContent.sponsors, ...sponsorShowcaseSlides]
    .filter((sponsor, index, rows) => rows.findIndex((row) => row.id === sponsor.id) === index)
    .slice(0, Math.max(5, aboutContent.sponsors.length));
  const committeeCount = committeeSlides.length;
  const sponsorCount = sponsorSlides.length;
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
    apiReadAboutContent()
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
      <PageHeroCarousel
        pageKey="about"
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
          <AboutCoverFlow
            className="is-committee"
            label="Current committee"
            items={committeeSlides}
            renderItem={(member) => (
              <article className="committee-card">
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
          <AboutCoverFlow
            className="is-sponsor"
            label="Our sponsors"
            items={sponsorSlides}
            renderItem={(sponsor, isActive) => {
              const hasDetails = Boolean(sponsor.name || sponsor.level || sponsor.note || sponsor.website);
              return (
                <button
                  className={hasDetails ? 'sponsor-card about-sponsor-card has-details' : 'sponsor-card about-sponsor-card image-only'}
                  type="button"
                  onClick={() => isActive && hasDetails && setActiveSponsor(sponsor)}
                  disabled={!hasDetails}
                  aria-label={isActive && hasDetails ? `View sponsor details for ${sponsor.name || sponsor.level || 'sponsor'}` : `Show ${sponsor.name || sponsor.level || 'sponsor'}`}
                >
                  <span className="sponsor-logo about-sponsor-logo">
                    {sponsor.photo
                      ? <img src={sponsor.photo} alt={sponsor.name || 'Sponsor logo'} />
                      : <span className="about-sponsor-placeholder-mark" aria-hidden="true">{sponsor.shortLabel || <Sparkles size={42} />}</span>}
                  </span>
                  <span className="about-cover-caption">
                    <strong>{sponsor.name || sponsor.level || 'Community sponsor'}</strong>
                    {sponsor.level && sponsor.name && <small>{sponsor.level}</small>}
                  </span>
                  {isActive && hasDetails && <span className="home-sponsor-detail-cue">View details</span>}
                </button>
              );
            }}
          />
        </div>}

        {activeSection === 'pastCommittees' && <div id="past-committees" className="about-directory-block active-about-panel" role="tabpanel">
          <div className="about-directory-title">
            <span><Award size={18} /> Past Committees</span>
            <strong>{pastCount}</strong>
          </div>
          <AboutCoverFlow
            className="is-past"
            label="Past committees"
            items={aboutContent.pastCommittees}
            renderItem={(committee) => (
              <article className="past-committee-card">
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

      {activeSponsor && (
        <div className="sponsor-detail-modal" role="dialog" aria-modal="true" aria-label="Sponsor details" onClick={() => setActiveSponsor(null)}>
          <article className="sponsor-detail-card" onClick={(event) => event.stopPropagation()}>
            <button className="sponsor-detail-close" type="button" onClick={() => setActiveSponsor(null)} aria-label="Close sponsor details">x</button>
            <div className="sponsor-detail-image">
              {activeSponsor.photo ? <img src={activeSponsor.photo} alt={activeSponsor.name || 'Sponsor logo'} /> : <Sparkles size={54} />}
            </div>
            <div className="sponsor-detail-copy">
              {activeSponsor.level && <span>{activeSponsor.level}</span>}
              <h3>{activeSponsor.name || 'Kannada Bharati sponsor'}</h3>
              {activeSponsor.note && <p>{activeSponsor.note}</p>}
              {activeSponsor.website && <a href={activeSponsor.website} target="_blank" rel="noreferrer">Visit sponsor</a>}
            </div>
          </article>
        </div>
      )}
    </>
  );
}
