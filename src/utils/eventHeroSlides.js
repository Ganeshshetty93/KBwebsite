export const defaultEventHeroSlides = [
  {
    id: 'events-rajyotsava',
    image: '/assets/hero/events-hero.png',
    alt: 'Kannada Bharati community celebration',
    caption: 'Celebrating Kannada language, culture, and community together.',
    position: 'center',
    enabled: true
  },
  {
    id: 'events-community',
    image: '/assets/feature/events-feature.png',
    alt: 'Kannada Bharati families at a community event',
    caption: 'Festivals and gatherings created for every generation.',
    position: 'center',
    enabled: true
  },
  {
    id: 'events-dance',
    image: '/assets/culture-feature/classical-dance-feature.png',
    alt: 'Classical dance performance',
    caption: 'A stage for dance, music, and Kannada performing arts.',
    position: 'center',
    enabled: true
  },
  {
    id: 'events-music',
    image: '/assets/culture-feature/music-traditions-feature.png',
    alt: 'Kannada music performance',
    caption: 'Shared traditions, joyful performances, lasting memories.',
    position: 'center',
    enabled: true
  },
  {
    id: 'events-cuisine',
    image: '/assets/culture-feature/cuisine-feature.png',
    alt: 'Traditional Karnataka cuisine',
    caption: 'Community experiences shaped by food, service, and celebration.',
    position: 'center',
    enabled: true
  }
];

export function normalizeEventHeroSlides(value, { includeDisabled = true } = {}) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 12)
    .map((slide, index) => ({
      id: String(slide?.id || `event-hero-${index + 1}`),
      image: String(slide?.image || '').trim(),
      alt: String(slide?.alt || '').trim().slice(0, 180),
      caption: String(slide?.caption || '').trim().slice(0, 180),
      position: ['top', 'center', 'bottom'].includes(slide?.position) ? slide.position : 'center',
      enabled: slide?.enabled !== false
    }))
    .filter((slide) => slide.image && (includeDisabled || slide.enabled));
}

export function cloneDefaultEventHeroSlides() {
  return defaultEventHeroSlides.map((slide) => ({ ...slide }));
}
