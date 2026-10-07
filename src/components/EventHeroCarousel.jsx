import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { apiReadSiteSetting } from '../utils/api.js';
import { cloneDefaultEventHeroSlides, normalizeEventHeroSlides } from '../utils/eventHeroSlides.js';

const ROTATION_DELAY = 6500;

export default function EventHeroCarousel({ eyebrow, title, text }) {
  const [slides, setSlides] = useState(cloneDefaultEventHeroSlides);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStart = useRef(null);

  useEffect(() => {
    let ignore = false;
    apiReadSiteSetting('events-hero-slides')
      .then((value) => {
        const savedSlides = normalizeEventHeroSlides(value, { includeDisabled: false });
        if (!ignore && savedSlides.length) setSlides(savedSlides);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.('change', updatePreference);
    return () => media.removeEventListener?.('change', updatePreference);
  }, []);

  useEffect(() => {
    if (slides.length < 2 || paused || interacting || reducedMotion) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, ROTATION_DELAY);
    return () => window.clearInterval(timer);
  }, [slides.length, paused, interacting, reducedMotion]);

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0);
  }, [activeIndex, slides.length]);

  function move(direction) {
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowLeft') move(-1);
    if (event.key === 'ArrowRight') move(1);
  }

  function handleTouchEnd(event) {
    if (touchStart.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
    touchStart.current = null;
  }

  const activeSlide = slides[activeIndex] || slides[0];

  return (
    <section
      className="events-hero events-carousel-hero"
      aria-roledescription="carousel"
      aria-label="Kannada Bharati event highlights"
      tabIndex="0"
      onKeyDown={handleKeyDown}
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
          <div
            className={`event-hero-slide ${index === activeIndex ? 'active' : ''}`}
            key={slide.id}
            aria-hidden={index !== activeIndex}
          >
            <img src={slide.image} alt={slide.alt} style={{ objectPosition: `center ${slide.position}` }} />
          </div>
        ))}
      </div>
      <div className="event-hero-shade" aria-hidden="true" />
      <div className="event-hero-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {text && <p className="event-hero-intro">{text}</p>}
        {activeSlide?.caption && <p className="event-hero-caption">{activeSlide.caption}</p>}
      </div>
      {slides.length > 1 && (
        <div className="event-hero-controls">
          <button type="button" onClick={() => move(-1)} aria-label="Previous event photo" title="Previous photo">
            <ChevronLeft size={21} />
          </button>
          <div className="event-hero-dots" aria-label="Choose event photo">
            {slides.map((slide, index) => (
              <button
                type="button"
                className={index === activeIndex ? 'active' : ''}
                key={slide.id}
                onClick={() => setActiveIndex(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
              />
            ))}
          </div>
          <button type="button" onClick={() => move(1)} aria-label="Next event photo" title="Next photo">
            <ChevronRight size={21} />
          </button>
          <button
            type="button"
            onClick={() => setPaused((current) => !current)}
            aria-label={paused ? 'Play event carousel' : 'Pause event carousel'}
            title={paused ? 'Play carousel' : 'Pause carousel'}
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
        </div>
      )}
    </section>
  );
}
