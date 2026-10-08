import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { apiReadSiteSetting } from '../utils/api.js';
import { cloneDefaultPageHeroSettings, getPageHeroConfig, normalizeEventHeroSlides } from '../utils/eventHeroSlides.js';

const ROTATION_DELAY = 6500;

export default function PageHeroCarousel({ pageKey, eyebrow, title, text, actions = [], className = '' }) {
  const [config, setConfig] = useState(() => cloneDefaultPageHeroSettings()[pageKey]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStart = useRef(null);

  useEffect(() => {
    let ignore = false;
    Promise.allSettled([
      apiReadSiteSetting('page-hero-settings'),
      pageKey === 'events' ? apiReadSiteSetting('events-hero-slides') : Promise.resolve([])
    ]).then(([settingsResult, legacyResult]) => {
      if (ignore) return;
      const settings = settingsResult.status === 'fulfilled' && settingsResult.value && typeof settingsResult.value === 'object'
        ? { ...settingsResult.value }
        : {};
      if (pageKey === 'events' && !settings.events && legacyResult.status === 'fulfilled') {
        const legacySlides = normalizeEventHeroSlides(legacyResult.value);
        if (legacySlides.length) settings.events = { mode: 'carousel', slides: legacySlides };
      }
      setConfig(getPageHeroConfig(settings, pageKey));
    });
    return () => { ignore = true; };
  }, [pageKey]);

  const slides = useMemo(() => {
    const enabled = (config?.slides || []).filter((slide) => slide.enabled);
    if (config?.mode !== 'single') return enabled;
    const selected = enabled.find((slide) => slide.id === config.selectedSlideId) || enabled[0];
    return selected ? [selected] : [];
  }, [config]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.('change', updatePreference);
    return () => media.removeEventListener?.('change', updatePreference);
  }, []);

  useEffect(() => {
    if (slides.length < 2 || paused || interacting || reducedMotion) return undefined;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % slides.length), ROTATION_DELAY);
    return () => window.clearInterval(timer);
  }, [slides.length, paused, interacting, reducedMotion]);

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0);
  }, [activeIndex, slides.length]);

  function move(direction) {
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  }

  function handleTouchEnd(event) {
    if (touchStart.current === null || slides.length < 2) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
    touchStart.current = null;
  }

  const activeSlide = slides[activeIndex] || slides[0];

  return (
    <section
      className={`page-hero-carousel events-carousel-hero ${className}`.trim()}
      aria-roledescription={slides.length > 1 ? 'carousel' : undefined}
      aria-label={`${eyebrow || pageKey} highlights`}
      tabIndex={slides.length > 1 ? '0' : undefined}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' && slides.length > 1) move(-1);
        if (event.key === 'ArrowRight' && slides.length > 1) move(1);
      }}
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setInteracting(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false);
      }}
      onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
      onTouchEnd={handleTouchEnd}
    >
      <div className="event-hero-slides" aria-live="off">
        {slides.map((slide, index) => (
          <div className={`event-hero-slide ${index === activeIndex ? 'active' : ''}`} key={slide.id} aria-hidden={index !== activeIndex}>
            <img src={slide.image} alt={slide.alt} style={{ objectPosition: `center ${slide.position}` }} />
          </div>
        ))}
      </div>
      <div className="event-hero-shade" aria-hidden="true" />
      <div className="event-hero-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {text && <p className="event-hero-intro">{text}</p>}
        {actions.length > 0 && (
          <div className="hero-actions">
            {actions.map((action) => (
              <Link key={action.href} className={`button ${action.variant || 'primary'}`} to={action.href}>{action.label}</Link>
            ))}
          </div>
        )}
        {activeSlide?.caption && <p className="event-hero-caption">{activeSlide.caption}</p>}
      </div>
      {slides.length > 1 && (
        <div className="event-hero-controls">
          <button type="button" onClick={() => move(-1)} aria-label="Previous hero photo" title="Previous photo"><ChevronLeft size={21} /></button>
          <div className="event-hero-dots" aria-label="Choose hero photo">
            {slides.map((slide, index) => (
              <button type="button" className={index === activeIndex ? 'active' : ''} key={slide.id} onClick={() => setActiveIndex(index)} aria-label={`Show photo ${index + 1}`} aria-current={index === activeIndex ? 'true' : undefined} />
            ))}
          </div>
          <button type="button" onClick={() => move(1)} aria-label="Next hero photo" title="Next photo"><ChevronRight size={21} /></button>
          <button type="button" onClick={() => setPaused((current) => !current)} aria-label={paused ? 'Play hero carousel' : 'Pause hero carousel'} title={paused ? 'Play carousel' : 'Pause carousel'}>
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
        </div>
      )}
    </section>
  );
}
