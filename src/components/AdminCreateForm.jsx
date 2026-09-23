import { useState } from 'react';
import { appendRecordAsync } from '../utils/storage.js';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || file.size === 0) {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function AdminCreateForm({ type, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const isClass = type === 'class';

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const form = event.currentTarget;
    const formData = new FormData(form);
    const photo = await fileToDataUrl(formData.get('photo'));
    const key = isClass ? 'kb-admin-classes' : 'kb-admin-events';
    const payload = isClass
      ? {
          title: formData.get('title'),
          category: formData.get('category'),
          status: 'Admin added',
          date: formData.get('date'),
          time: formData.get('time'),
          age: formData.get('age'),
          fee: formData.get('fee'),
          location: formData.get('location'),
          focus: formData.get('description'),
          photo
        }
      : {
          month: formData.get('date'),
          title: formData.get('title'),
          body: formData.get('description'),
          location: formData.get('location'),
          photo
        };

    await appendRecordAsync(key, payload);
    form.reset();
    setSaving(false);
    setMessage(`${isClass ? 'Class' : 'Event'} added successfully.`);
    onCreated?.();
  }

  return (
    <form className="admin-create-form" onSubmit={handleSubmit}>
      <h2>{isClass ? 'Add class' : 'Add event'}</h2>
      <div className="admin-form-grid">
        <label>
          {isClass ? 'Class name' : 'Event title'}
          <input name="title" required placeholder={isClass ? 'Yoga / Drama / Kannada Level 7' : 'Ugadi celebration'} />
        </label>
        <label>
          {isClass ? 'Date range' : 'Event date'}
          <input name="date" required placeholder={isClass ? 'Jan 10 - Mar 30, 2027' : 'Apr 12, 2027'} />
        </label>
        {isClass && (
          <>
            <label>
              Category
              <select name="category" required defaultValue="Arts">
                <option>Language</option>
                <option>Music</option>
                <option>Dance</option>
                <option>Arts</option>
              </select>
            </label>
            <label>
              Time
              <input name="time" required placeholder="Sundays, 11:00 AM - 12:00 PM" />
            </label>
            <label>
              Age group
              <input name="age" required placeholder="Ages 8-14" />
            </label>
            <label>
              Fee
              <input name="fee" required placeholder="$100" />
            </label>
          </>
        )}
        <label>
          Location
          <input name="location" required placeholder="Bellevue / Online" />
        </label>
        <label>
          Photo upload
          <input name="photo" type="file" accept="image/*" />
        </label>
      </div>
      <label>
        Description
        <textarea name="description" required placeholder={isClass ? 'Short class description' : 'Event details'} />
      </label>
      <button className="button primary" type="submit" disabled={saving}>
        {saving ? 'Saving...' : isClass ? 'Add Class' : 'Add Event'}
      </button>
      {message && <p className="success">{message}</p>}
    </form>
  );
}
