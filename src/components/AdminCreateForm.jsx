import { useState } from 'react';
import { appendAdminRecordAsync } from '../utils/storage.js';

const weekDays = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

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

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(value) {
  if (!value) return '';
  const [hourText, minuteText] = value.split(':');
  const date = new Date();
  date.setHours(Number(hourText), Number(minuteText), 0, 0);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function positiveAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return '';
  return `$${amount}`;
}

export default function AdminCreateForm({ type, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const isClass = type === 'class';

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    const form = event.currentTarget;
    const formData = new FormData(form);
    const photo = await fileToDataUrl(formData.get('photo'));
    const key = isClass ? 'kb-admin-classes' : 'kb-admin-events';
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');
    const startTime = formData.get('startTime');
    const endTime = formData.get('endTime');

    if (isClass && startDate && endDate && endDate < startDate) {
      setSaving(false);
      setError('Class end date cannot be before start date.');
      return;
    }

    if (isClass && startTime && endTime && endTime <= startTime) {
      setSaving(false);
      setError('Class end time must be after start time.');
      return;
    }

    const payload = isClass
      ? {
          title: formData.get('title').trim(),
          category: formData.get('category'),
          status: formData.get('status'),
          date: `${formatDate(startDate)} - ${formatDate(endDate)}`,
          time: `${formData.get('weekday')}, ${formatTime(startTime)} - ${formatTime(endTime)}`,
          age: formData.get('age'),
          fee: positiveAmount(formData.get('fee')),
          location: formData.get('location').trim(),
          focus: formData.get('description').trim(),
          photo
        }
      : {
          month: formatDate(formData.get('eventDate')),
          title: formData.get('title').trim(),
          body: formData.get('description').trim(),
          location: formData.get('location').trim(),
          photo
        };

    try {
      await appendAdminRecordAsync(key, payload);
      form.reset();
      setMessage(`${isClass ? 'Class' : 'Event'} added successfully and saved to database.`);
      onCreated?.();
    } catch (error) {
      setError(error.message || `Could not save ${isClass ? 'class' : 'event'} to database.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-create-form" onSubmit={handleSubmit}>
      <h2>{isClass ? 'Add class' : 'Add event'}</h2>
      <p className="admin-form-note">
        {isClass
          ? 'Use date and time pickers so class cards display consistently.'
          : 'Use the event date picker so event cards and calendar entries stay consistent.'}
      </p>
      <div className="admin-form-grid">
        <label>
          {isClass ? 'Class name' : 'Event title'}
          <input name="title" required minLength="3" maxLength="80" placeholder={isClass ? 'Yoga / Drama / Kannada Level 7' : 'Ugadi celebration'} />
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
              Status
              <select name="status" required defaultValue="New and returning students">
                <option>New and returning students</option>
                <option>New students</option>
                <option>Returning students</option>
                <option>Online</option>
                <option>Waitlist</option>
              </select>
            </label>
            <label>
              Start date
              <input name="startDate" type="date" required />
            </label>
            <label>
              End date
              <input name="endDate" type="date" required />
            </label>
            <label>
              Weekday
              <select name="weekday" required defaultValue="Sundays">
                {weekDays.map((day) => <option key={day}>{day}</option>)}
              </select>
            </label>
            <label>
              Start time
              <input name="startTime" type="time" required />
            </label>
            <label>
              End time
              <input name="endTime" type="time" required />
            </label>
            <label>
              Fee amount
              <input name="fee" type="number" min="0" step="1" required placeholder="100" />
            </label>
            <label>
              Age group
              <input name="age" required minLength="3" maxLength="40" placeholder="Ages 8-14" />
            </label>
          </>
        )}
        {!isClass && (
          <label>
            Event date
            <input name="eventDate" type="date" required />
          </label>
        )}
        <label>
          Location
          <input name="location" required minLength="3" maxLength="120" placeholder="Bellevue / Online" />
        </label>
        <label>
          Photo upload
          <input name="photo" type="file" accept="image/*" />
        </label>
      </div>
      <label>
        Description
        <textarea name="description" required minLength="10" maxLength="320" placeholder={isClass ? 'Short class description' : 'Event details'} />
      </label>
      <button className="button primary" type="submit" disabled={saving}>
        {saving ? 'Saving...' : isClass ? 'Add Class' : 'Add Event'}
      </button>
      {message && <p className="success">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
