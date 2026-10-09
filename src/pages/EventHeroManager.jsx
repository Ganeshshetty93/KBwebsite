import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye, EyeOff, GalleryHorizontal, Image, ImagePlus, Save, Trash2, Upload } from 'lucide-react';
import PageLoader from '../components/PageLoader.jsx';
import { apiReadSiteSetting, apiSaveSiteSetting, apiUploadFile } from '../utils/api.js';
import {
  cloneDefaultPageHeroSettings,
  heroPageDefinitions,
  normalizeEventHeroSlides,
  normalizePageHeroSettings
} from '../utils/eventHeroSlides.js';
import { validateImageFile } from '../utils/validation.js';
import { normalizeEventMemories } from '../utils/eventMemories.js';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function makeId(pageKey) {
  return globalThis.crypto?.randomUUID?.() || `${pageKey}-hero-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function EventHeroManager() {
  const [settings, setSettings] = useState(cloneDefaultPageHeroSettings);
  const [activePage, setActivePage] = useState('home');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [memories, setMemories] = useState([]);
  const [memoriesUploading, setMemoriesUploading] = useState(false);
  const [memoriesSaving, setMemoriesSaving] = useState(false);
  const [memoriesError, setMemoriesError] = useState('');
  const [memoriesNotice, setMemoriesNotice] = useState('');
  const [tabScroll, setTabScroll] = useState({ atStart: true, atEnd: false });
  const inputRef = useRef(null);
  const memoriesInputRef = useRef(null);
  const tabsRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    Promise.allSettled([
      apiReadSiteSetting('page-hero-settings'),
      apiReadSiteSetting('events-hero-slides'),
      apiReadSiteSetting('event-memories')
    ]).then(([pageResult, legacyResult, memoriesResult]) => {
      if (ignore) return;
      const value = pageResult.status === 'fulfilled' && pageResult.value && typeof pageResult.value === 'object'
        ? { ...pageResult.value }
        : {};
      if (!value.events && legacyResult.status === 'fulfilled') {
        const legacySlides = normalizeEventHeroSlides(legacyResult.value);
        if (legacySlides.length) value.events = { mode: 'carousel', slides: legacySlides };
      }
      setSettings(normalizePageHeroSettings(value));
      if (memoriesResult.status === 'fulfilled') {
        setMemories(normalizeEventMemories(memoriesResult.value));
      }
      if (pageResult.status === 'rejected' && legacyResult.status === 'rejected') {
        setError('Could not load saved hero settings. Defaults are shown.');
      }
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs || loading) return undefined;

    function updateTabScroll() {
      const maxScroll = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
      setTabScroll({
        atStart: tabs.scrollLeft <= 2,
        atEnd: tabs.scrollLeft >= maxScroll - 2
      });
    }

    updateTabScroll();
    tabs.addEventListener('scroll', updateTabScroll, { passive: true });
    window.addEventListener('resize', updateTabScroll);
    return () => {
      tabs.removeEventListener('scroll', updateTabScroll);
      window.removeEventListener('resize', updateTabScroll);
    };
  }, [loading]);

  const pageDefinition = heroPageDefinitions.find((page) => page.key === activePage) || heroPageDefinitions[0];
  const config = settings[activePage] || cloneDefaultPageHeroSettings()[activePage];
  const slides = config.slides || [];
  const enabledSlides = slides.filter((slide) => slide.enabled);
  const previewSlide = config.mode === 'single'
    ? enabledSlides.find((slide) => slide.id === config.selectedSlideId) || enabledSlides[0]
    : enabledSlides[0] || slides[0];

  function updateConfig(updater) {
    setSettings((current) => ({
      ...current,
      [activePage]: updater(current[activePage] || cloneDefaultPageHeroSettings()[activePage])
    }));
    setNotice('');
  }

  function scrollPageTabs(direction) {
    const tabs = tabsRef.current;
    if (!tabs) return;
    tabs.scrollBy({ left: direction * Math.max(148, tabs.clientWidth * 0.72), behavior: 'smooth' });
  }

  function updateSlide(id, field, value) {
    updateConfig((current) => ({
      ...current,
      slides: current.slides.map((slide) => (slide.id === id ? { ...slide, [field]: value } : slide))
    }));
  }

  function moveSlide(index, direction) {
    const destination = index + direction;
    if (destination < 0 || destination >= slides.length) return;
    updateConfig((current) => {
      const next = [...current.slides];
      [next[index], next[destination]] = [next[destination], next[index]];
      return { ...current, slides: next };
    });
  }

  function removeSlide(id) {
    if (!window.confirm(`Remove this photo from the ${pageDefinition.label} hero?`)) return;
    updateConfig((current) => {
      const nextSlides = current.slides.filter((slide) => slide.id !== id);
      return {
        ...current,
        slides: nextSlides,
        selectedSlideId: current.selectedSlideId === id ? nextSlides.find((slide) => slide.enabled)?.id || '' : current.selectedSlideId
      };
    });
  }

  async function uploadPhotos(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (slides.length + files.length > 12) {
      setError('Each page supports up to 12 hero photos.');
      return;
    }
    const invalid = files.map(validateImageFile).find(Boolean);
    if (invalid) {
      setError(invalid);
      return;
    }

    setUploading(true);
    setError('');
    setNotice('');
    try {
      const additions = [];
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        const uploaded = await apiUploadFile({
          dataUrl,
          fileName: file.name,
          container: 'assets',
          directory: `page-heroes/${activePage}`
        });
        additions.push({
          id: makeId(activePage),
          image: uploaded.url || dataUrl,
          alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
          caption: '',
          position: 'center',
          enabled: true
        });
      }
      updateConfig((current) => ({
        ...current,
        selectedSlideId: current.selectedSlideId || additions[0]?.id || '',
        slides: [...current.slides, ...additions]
      }));
      setNotice(`${additions.length} photo${additions.length === 1 ? '' : 's'} added to ${pageDefinition.label}. Save changes to publish.`);
    } catch (uploadError) {
      setError(uploadError.message || 'Photo upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function saveSettings() {
    const cleaned = normalizePageHeroSettings(settings, { useDefaults: false });
    for (const page of heroPageDefinitions) {
      const pageConfig = cleaned[page.key];
      if (!pageConfig.slides.length || !pageConfig.slides.some((slide) => slide.enabled)) {
        setActivePage(page.key);
        setError(`${page.label} needs at least one visible hero photo.`);
        return;
      }
      if (pageConfig.slides.some((slide) => !slide.alt)) {
        setActivePage(page.key);
        setError(`Add accessible image text for every ${page.label} photo.`);
        return;
      }
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await apiSaveSiteSetting('page-hero-settings', cleaned);
      setSettings(normalizePageHeroSettings(saved));
      setNotice('Hero settings saved and published for all pages.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save the hero settings.');
    } finally {
      setSaving(false);
    }
  }

  function updateMemory(id, field, value) {
    setMemories((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    setMemoriesNotice('');
  }

  function moveMemory(index, direction) {
    const destination = index + direction;
    if (destination < 0 || destination >= memories.length) return;
    setMemories((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
    setMemoriesNotice('');
  }

  function removeMemory(id) {
    if (!window.confirm('Remove this photo from Event Memories?')) return;
    setMemories((current) => current.filter((item) => item.id !== id));
    setMemoriesNotice('');
  }

  async function uploadMemoryPhotos(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (memories.length + files.length > 40) {
      setMemoriesError('Event Memories supports up to 40 photos.');
      return;
    }
    const invalid = files.map(validateImageFile).find(Boolean);
    if (invalid) {
      setMemoriesError(invalid);
      return;
    }

    setMemoriesUploading(true);
    setMemoriesError('');
    setMemoriesNotice('');
    try {
      const additions = [];
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        const uploaded = await apiUploadFile({
          dataUrl,
          fileName: file.name,
          container: 'assets',
          directory: 'event-memories'
        });
        const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
        additions.push({
          id: makeId('memory'),
          image: uploaded.url || dataUrl,
          title,
          date: 'Past celebration',
          alt: title,
          enabled: true
        });
      }
      setMemories((current) => [...current, ...additions]);
      setMemoriesNotice(`${additions.length} memory photo${additions.length === 1 ? '' : 's'} uploaded. Save memories to publish.`);
    } catch (uploadError) {
      setMemoriesError(uploadError.message || 'Memory photo upload failed.');
    } finally {
      setMemoriesUploading(false);
    }
  }

  async function saveMemories() {
    const cleaned = normalizeEventMemories(memories);
    if (cleaned.some((item) => !item.title || !item.alt)) {
      setMemoriesError('Add a title and accessible image text for every memory photo.');
      return;
    }
    setMemoriesSaving(true);
    setMemoriesError('');
    setMemoriesNotice('');
    try {
      const saved = await apiSaveSiteSetting('event-memories', cleaned);
      setMemories(normalizeEventMemories(saved));
      setMemoriesNotice('Event Memories saved and published.');
    } catch (saveError) {
      setMemoriesError(saveError.message || 'Could not save Event Memories.');
    } finally {
      setMemoriesSaving(false);
    }
  }

  if (loading) return <PageLoader active label="Loading page hero photos" />;

  return (
    <div className="event-hero-admin">
      <header className="admin-page-header event-hero-admin-header">
        <div>
          <p>Website / Gallery</p>
          <h1>Page background gallery</h1>
        </div>
        <div className="event-hero-admin-actions">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={uploadPhotos} />
          <button className="button secondary-dark" type="button" onClick={() => inputRef.current?.click()} disabled={uploading || slides.length >= 12}>
            <Upload size={17} /> {uploading ? 'Uploading...' : `Upload to ${pageDefinition.label}`}
          </button>
          <button className="button" type="button" onClick={saveSettings} disabled={saving || uploading}>
            <Save size={17} /> {saving ? 'Saving...' : 'Save all pages'}
          </button>
        </div>
      </header>

      <div className="page-hero-tabs-slider">
        <button className="page-hero-tabs-arrow previous" type="button" onClick={() => scrollPageTabs(-1)} disabled={tabScroll.atStart} aria-label="Previous page menu items">
          <ChevronLeft size={19} />
        </button>
        <nav className="page-hero-admin-tabs" aria-label="Choose page to edit" ref={tabsRef}>
          {heroPageDefinitions.map((page) => (
            <button
              type="button"
              className={activePage === page.key ? 'active' : ''}
              key={page.key}
              onClick={() => {
                setActivePage(page.key);
                setError('');
                setNotice('');
              }}
            >
              <span className="page-hero-tab-label">{page.label}</span>
              <span className="page-hero-tab-count">{settings[page.key]?.slides?.filter((slide) => slide.enabled).length || 0}</span>
            </button>
          ))}
        </nav>
        <button className="page-hero-tabs-arrow next" type="button" onClick={() => scrollPageTabs(1)} disabled={tabScroll.atEnd} aria-label="Next page menu items">
          <ChevronRight size={19} />
        </button>
      </div>

      <section className="page-hero-display-settings admin-page-panel">
        <div>
          <p className="eyebrow">{pageDefinition.label} display</p>
          <h2>Choose how the background behaves</h2>
          <p>Carousel rotates through visible photos. Single image keeps one selected photo fixed.</p>
        </div>
        <div className="page-hero-mode-control" aria-label="Hero display mode">
          <button type="button" className={config.mode === 'carousel' ? 'active' : ''} onClick={() => updateConfig((current) => ({ ...current, mode: 'carousel' }))}>
            <GalleryHorizontal size={18} /> Auto carousel
          </button>
          <button type="button" className={config.mode === 'single' ? 'active' : ''} onClick={() => updateConfig((current) => ({ ...current, mode: 'single' }))}>
            <Image size={18} /> Single image
          </button>
        </div>
        {config.mode === 'single' && (
          <label className="page-hero-single-select">
            Image shown on {pageDefinition.label}
            <select value={config.selectedSlideId} onChange={(event) => updateConfig((current) => ({ ...current, selectedSlideId: event.target.value }))}>
              {enabledSlides.map((slide, index) => <option value={slide.id} key={slide.id}>{slide.alt || `Photo ${index + 1}`}</option>)}
            </select>
          </label>
        )}
      </section>

      {error && <p className="admin-inline-message error" role="alert">{error}</p>}
      {notice && <p className="admin-inline-message" role="status">{notice}</p>}

      {previewSlide && (
        <section className="event-hero-admin-preview" aria-label={`${pageDefinition.label} hero preview`}>
          <img src={previewSlide.image} alt={previewSlide.alt} style={{ objectPosition: `center ${previewSlide.position}` }} />
          <div>
            <span>{pageDefinition.label} preview · {config.mode === 'single' ? 'Single image' : 'Auto carousel'}</span>
            <strong>{pageDefinition.title}</strong>
            <p>{previewSlide.caption || `This photo will fill the ${pageDefinition.label} page hero background.`}</p>
          </div>
        </section>
      )}

      <section className="admin-page-panel event-hero-slide-panel">
        <div className="admin-page-panel-heading">
          <div>
            <h2>{pageDefinition.label} photos</h2>
            <p>Visible photos rotate in this order. In single-image mode, choose the fixed image above.</p>
          </div>
          <span>{slides.length}</span>
        </div>
        {!slides.length ? (
          <button className="event-hero-empty" type="button" onClick={() => inputRef.current?.click()}>
            <ImagePlus size={30} />
            <strong>Upload the first {pageDefinition.label} photo</strong>
            <small>JPG, PNG, or WebP, up to 2 MB each</small>
          </button>
        ) : (
          <div className="event-hero-admin-list">
            {slides.map((slide, index) => (
              <article className={`event-hero-admin-row ${slide.enabled ? '' : 'disabled'}`} key={slide.id}>
                <div className="event-hero-admin-thumb">
                  <img src={slide.image} alt="" style={{ objectPosition: `center ${slide.position}` }} />
                  <span>{index + 1}</span>
                </div>
                <div className="event-hero-admin-fields">
                  <label>
                    Accessible image text
                    <input value={slide.alt} maxLength="180" onChange={(event) => updateSlide(slide.id, 'alt', event.target.value)} placeholder="Describe this photo" />
                  </label>
                  <label>
                    Short caption
                    <input value={slide.caption} maxLength="180" onChange={(event) => updateSlide(slide.id, 'caption', event.target.value)} placeholder="Optional caption shown over the photo" />
                  </label>
                  <label>
                    Image focus
                    <select value={slide.position} onChange={(event) => updateSlide(slide.id, 'position', event.target.value)}>
                      <option value="top">Top</option>
                      <option value="center">Center</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </label>
                </div>
                <div className="event-hero-row-actions">
                  <button type="button" onClick={() => updateSlide(slide.id, 'enabled', !slide.enabled)} aria-label={slide.enabled ? 'Hide photo' : 'Show photo'} title={slide.enabled ? 'Hide photo' : 'Show photo'}>
                    {slide.enabled ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                  <button type="button" onClick={() => moveSlide(index, -1)} disabled={index === 0} aria-label="Move photo up" title="Move up"><ArrowUp size={18} /></button>
                  <button type="button" onClick={() => moveSlide(index, 1)} disabled={index === slides.length - 1} aria-label="Move photo down" title="Move down"><ArrowDown size={18} /></button>
                  <button className="danger" type="button" onClick={() => removeSlide(slide.id)} aria-label="Delete photo" title="Delete photo"><Trash2 size={18} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-page-panel event-hero-slide-panel event-memories-admin-panel">
        <div className="admin-page-panel-heading event-memories-admin-heading">
          <div>
            <h2>Event Memories</h2>
            <p>Photos published in the “Old celebrated events photos” section on the Events page.</p>
          </div>
          <div className="event-memories-heading-actions">
            <span className="event-memories-count" aria-label={`${memories.length} event ${memories.length === 1 ? 'photo' : 'photos'}`}>
              {memories.length} {memories.length === 1 ? 'photo' : 'photos'}
            </span>
            <input ref={memoriesInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={uploadMemoryPhotos} />
            <button
              className="event-memory-icon-button"
              type="button"
              onClick={() => memoriesInputRef.current?.click()}
              disabled={memoriesUploading || memories.length >= 40}
              aria-label={memoriesUploading ? 'Uploading memories' : 'Upload memories'}
              data-tooltip={memoriesUploading ? 'Uploading...' : memories.length >= 40 ? 'Maximum 40 photos' : 'Upload memories'}
            >
              <Upload size={19} />
            </button>
            <button
              className="event-memory-icon-button is-primary"
              type="button"
              onClick={saveMemories}
              disabled={memoriesSaving || memoriesUploading}
              aria-label={memoriesSaving ? 'Saving memories' : 'Save memories'}
              data-tooltip={memoriesSaving ? 'Saving...' : 'Save memories'}
            >
              <Save size={19} />
            </button>
          </div>
        </div>
        {memoriesError && <p className="admin-inline-message error event-memories-message" role="alert">{memoriesError}</p>}
        {memoriesNotice && <p className="admin-inline-message event-memories-message" role="status">{memoriesNotice}</p>}
        {!memories.length ? (
          <button className="event-hero-empty" type="button" onClick={() => memoriesInputRef.current?.click()}>
            <ImagePlus size={30} />
            <strong>Upload past event photos</strong>
            <small>These photos will replace the placeholder tiles on the Events page</small>
          </button>
        ) : (
          <div className="event-hero-admin-list">
            {memories.map((item, index) => (
              <article className={`event-hero-admin-row ${item.enabled ? '' : 'disabled'}`} key={item.id}>
                <div className="event-hero-admin-thumb">
                  <img src={item.image} alt="" />
                  <span>{index + 1}</span>
                </div>
                <div className="event-hero-admin-fields">
                  <label>
                    Event title
                    <input value={item.title} maxLength="120" onChange={(event) => updateMemory(item.id, 'title', event.target.value)} placeholder="Kannada Rajyotsava 2025" />
                  </label>
                  <label>
                    Celebration label
                    <input value={item.date} maxLength="80" onChange={(event) => updateMemory(item.id, 'date', event.target.value)} placeholder="November 2025" />
                  </label>
                  <label>
                    Accessible image text
                    <input value={item.alt} maxLength="180" onChange={(event) => updateMemory(item.id, 'alt', event.target.value)} placeholder="Describe this photo" />
                  </label>
                </div>
                <div className="event-hero-row-actions">
                  <button className="event-memory-icon-button" type="button" onClick={() => updateMemory(item.id, 'enabled', !item.enabled)} aria-label={item.enabled ? 'Hide memory' : 'Show memory'} data-tooltip={item.enabled ? 'Hide memory' : 'Show memory'}>
                    {item.enabled ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                  <button className="event-memory-icon-button" type="button" onClick={() => moveMemory(index, -1)} disabled={index === 0} aria-label="Move memory up" data-tooltip="Move up"><ArrowUp size={18} /></button>
                  <button className="event-memory-icon-button" type="button" onClick={() => moveMemory(index, 1)} disabled={index === memories.length - 1} aria-label="Move memory down" data-tooltip="Move down"><ArrowDown size={18} /></button>
                  <button className="event-memory-icon-button danger" type="button" onClick={() => removeMemory(item.id)} aria-label="Delete memory" data-tooltip="Delete memory"><Trash2 size={18} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
