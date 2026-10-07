import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Save, Trash2, Upload } from 'lucide-react';
import PageLoader from '../components/PageLoader.jsx';
import { apiReadSiteSetting, apiSaveSiteSetting, apiUploadFile } from '../utils/api.js';
import { cloneDefaultEventHeroSlides, normalizeEventHeroSlides } from '../utils/eventHeroSlides.js';
import { validateImageFile } from '../utils/validation.js';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `event-hero-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function EventHeroManager() {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    apiReadSiteSetting('events-hero-slides')
      .then((value) => {
        if (ignore) return;
        const saved = normalizeEventHeroSlides(value);
        setSlides(saved.length ? saved : cloneDefaultEventHeroSlides());
      })
      .catch((loadError) => {
        if (!ignore) {
          setSlides(cloneDefaultEventHeroSlides());
          setError(loadError.message || 'Could not load the carousel settings.');
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, []);

  function updateSlide(id, field, value) {
    setSlides((current) => current.map((slide) => (slide.id === id ? { ...slide, [field]: value } : slide)));
    setNotice('');
  }

  function moveSlide(index, direction) {
    const destination = index + direction;
    if (destination < 0 || destination >= slides.length) return;
    setSlides((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
    setNotice('');
  }

  function removeSlide(id) {
    if (!window.confirm('Remove this photo from the Events carousel?')) return;
    setSlides((current) => current.filter((slide) => slide.id !== id));
    setNotice('');
  }

  async function uploadPhotos(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (slides.length + files.length > 12) {
      setError('The carousel supports up to 12 photos.');
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
          directory: 'events-hero'
        });
        additions.push({
          id: makeId(),
          image: uploaded.url || dataUrl,
          alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
          caption: '',
          position: 'center',
          enabled: true
        });
      }
      setSlides((current) => [...current, ...additions]);
      setNotice(`${additions.length} photo${additions.length === 1 ? '' : 's'} uploaded. Save changes to publish.`);
    } catch (uploadError) {
      setError(uploadError.message || 'Photo upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function saveSlides() {
    const cleaned = normalizeEventHeroSlides(slides);
    if (!cleaned.length) {
      setError('Add at least one carousel photo before saving.');
      return;
    }
    if (!cleaned.some((slide) => slide.enabled)) {
      setError('Keep at least one carousel photo visible.');
      return;
    }
    if (cleaned.some((slide) => !slide.alt)) {
      setError('Add accessible image text for every photo.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await apiSaveSiteSetting('events-hero-slides', cleaned);
      setSlides(normalizeEventHeroSlides(saved));
      setNotice('Events carousel saved and published.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save the carousel.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader active label="Loading events carousel" />;

  const previewSlide = slides.find((slide) => slide.enabled) || slides[0];

  return (
    <div className="event-hero-admin">
      <header className="admin-page-header event-hero-admin-header">
        <div>
          <p>Events / Hero carousel</p>
          <h1>Events background carousel</h1>
        </div>
        <div className="event-hero-admin-actions">
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={uploadPhotos} />
          <button className="button secondary" type="button" onClick={() => inputRef.current?.click()} disabled={uploading || slides.length >= 12}>
            <Upload size={17} /> {uploading ? 'Uploading...' : 'Upload photos'}
          </button>
          <button className="button" type="button" onClick={saveSlides} disabled={saving || uploading}>
            <Save size={17} /> {saving ? 'Saving...' : 'Save & publish'}
          </button>
        </div>
      </header>

      {error && <p className="admin-inline-message error" role="alert">{error}</p>}
      {notice && <p className="admin-inline-message" role="status">{notice}</p>}

      {previewSlide && (
        <section className="event-hero-admin-preview" aria-label="Carousel preview">
          <img src={previewSlide.image} alt={previewSlide.alt} style={{ objectPosition: `center ${previewSlide.position}` }} />
          <div>
            <span>Live preview</span>
            <strong>Festivals, showcases, and community gatherings.</strong>
            <p>{previewSlide.caption || 'Your photo will fill the Events page hero background.'}</p>
          </div>
        </section>
      )}

      <section className="admin-page-panel event-hero-slide-panel">
        <div className="admin-page-panel-heading">
          <div>
            <h2>Carousel photos</h2>
            <p>Drag-free ordering keeps this easy on mobile. Use the arrows to set the playback order.</p>
          </div>
          <span>{slides.length}</span>
        </div>
        {!slides.length ? (
          <button className="event-hero-empty" type="button" onClick={() => inputRef.current?.click()}>
            <ImagePlus size={30} />
            <strong>Upload the first event photo</strong>
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
                    <input value={slide.alt} maxLength="180" onChange={(event) => updateSlide(slide.id, 'alt', event.target.value)} placeholder="Describe the event photo" />
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
    </div>
  );
}
