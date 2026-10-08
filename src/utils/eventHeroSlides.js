export const heroPageDefinitions = [
  { key: 'home', label: 'Home', title: 'Welcome to Kannada Bharati' },
  { key: 'about', label: 'About Us', title: 'Keeping Kannada culture close to home' },
  { key: 'classes', label: 'Classes', title: 'Classes for every interest' },
  { key: 'paataShaale', label: 'Paata Shaale', title: 'Kannada Paata Shaale' },
  { key: 'events', label: 'Events', title: 'Festivals, showcases, and community gatherings' },
  { key: 'volunteer', label: 'Volunteer', title: 'Volunteer with Kannada Bharati' }
];

const defaults = {
  home: [
    ['/assets/kannada-bharati-hero.png', 'Kannada Bharati community celebration', 'Language, culture, and community across Washington.'],
    ['/assets/culture/about-hero-culture.png', 'Karnataka cultural traditions', 'Keeping Karnataka traditions vibrant for every generation.'],
    ['/assets/culture-feature/mysuru-palace-feature.png', 'Mysuru Palace illuminated at night', 'Discover the stories, places, and spirit of Karnataka.']
  ],
  about: [
    ['/assets/culture/about-hero-culture.png', 'Kannada Bharati cultural community', 'A volunteer-led community preserving Kannada language and culture.'],
    ['/assets/culture-feature/yakshagana-feature.png', 'Traditional Yakshagana performance', 'Celebrating the art, stories, and traditions of Karnataka.'],
    ['/assets/culture-feature/hampi-feature.png', 'Historic monuments of Hampi', 'Connecting generations through Karnataka heritage and shared memories.']
  ],
  classes: [
    ['/assets/hero/classes-hero.png', 'Kannada Bharati cultural class', 'Learn, create, perform, and grow together.'],
    ['/assets/classes/carnatic-music.png', 'Carnatic music class', 'Music instruction rooted in Karnataka traditions.'],
    ['/assets/classes/bharatanatya-dance.png', 'Bharatanatya dance class', 'Build confidence through classical and contemporary arts.']
  ],
  paataShaale: [
    ['/assets/hero/shaale-hero.png', 'Kannada Paata Shaale students', 'Kannada learning designed for young minds.'],
    ['/assets/classes/kannada-language-class.png', 'Children learning Kannada together', 'Read, write, speak, and connect through Kannada.'],
    ['/assets/classes/kannada-language.png', 'Kannada language learning materials', 'A welcoming path from first letters to confident conversation.']
  ],
  events: [
    ['/assets/hero/events-hero.png', 'Kannada Bharati community celebration', 'Celebrating Kannada language, culture, and community together.'],
    ['/assets/feature/events-feature.png', 'Kannada Bharati families at a community event', 'Festivals and gatherings created for every generation.'],
    ['/assets/culture-feature/classical-dance-feature.png', 'Classical dance performance', 'A stage for dance, music, and Kannada performing arts.'],
    ['/assets/culture-feature/music-traditions-feature.png', 'Kannada music performance', 'Shared traditions, joyful performances, lasting memories.'],
    ['/assets/culture-feature/cuisine-feature.png', 'Traditional Karnataka cuisine', 'Community experiences shaped by food, service, and celebration.']
  ],
  volunteer: [
    ['/assets/hero/volunteer-hero.png', 'Kannada Bharati volunteers serving the community', 'Give your time, share your skills, and strengthen our community.'],
    ['/assets/feature/service-feature.png', 'Community members volunteering together', 'Small acts of service create a lasting community impact.'],
    ['/assets/feature/events-feature.png', 'Volunteers supporting a Kannada Bharati event', 'Help make welcoming events possible for every family.']
  ]
};

function makeDefaultSlides(pageKey) {
  return (defaults[pageKey] || []).map(([image, alt, caption], index) => ({
    id: `${pageKey}-hero-${index + 1}`,
    image,
    alt,
    caption,
    position: 'center',
    enabled: true
  }));
}

export function normalizeEventHeroSlides(value, { includeDisabled = true } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 12)
    .map((slide, index) => ({
      id: String(slide?.id || `page-hero-${index + 1}`),
      image: String(slide?.image || '').trim(),
      alt: String(slide?.alt || '').trim().slice(0, 180),
      caption: String(slide?.caption || '').trim().slice(0, 180),
      position: ['top', 'center', 'bottom'].includes(slide?.position) ? slide.position : 'center',
      enabled: slide?.enabled !== false
    }))
    .filter((slide) => slide.image && (includeDisabled || slide.enabled));
}

export function cloneDefaultPageHeroSettings() {
  return Object.fromEntries(heroPageDefinitions.map(({ key }) => {
    const slides = makeDefaultSlides(key);
    return [key, { mode: 'carousel', selectedSlideId: slides[0]?.id || '', slides }];
  }));
}

export function normalizePageHeroSettings(value = {}, { useDefaults = true } = {}) {
  const fallback = cloneDefaultPageHeroSettings();
  return Object.fromEntries(heroPageDefinitions.map(({ key }) => {
    const supplied = value && typeof value === 'object' ? value[key] : null;
    const normalizedSlides = normalizeEventHeroSlides(supplied?.slides);
    const slides = normalizedSlides.length || !useDefaults ? normalizedSlides : fallback[key].slides;
    const enabledSlides = slides.filter((slide) => slide.enabled);
    const requestedSelection = String(supplied?.selectedSlideId || '');
    const selectedSlideId = enabledSlides.some((slide) => slide.id === requestedSelection)
      ? requestedSelection
      : enabledSlides[0]?.id || slides[0]?.id || '';
    return [key, {
      mode: supplied?.mode === 'single' ? 'single' : 'carousel',
      selectedSlideId,
      slides
    }];
  }));
}

export function getPageHeroConfig(settings, pageKey) {
  return normalizePageHeroSettings(settings)[pageKey] || cloneDefaultPageHeroSettings()[pageKey];
}

export function cloneDefaultEventHeroSlides() {
  return cloneDefaultPageHeroSettings().events.slides;
}
