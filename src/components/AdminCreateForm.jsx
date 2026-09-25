import { useState } from 'react';
import { appendAdminRecordAsync } from '../utils/storage.js';
import {
  cleanText,
  firstError,
  validateAmount,
  validateDateOrder,
  validateImageFile,
  validateRequired,
  validateTimeOrder
} from '../utils/validation.js';

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
  const dateValue = String(value).slice(0, 10);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${dateValue}T00:00:00Z`));
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
  const isFundraiser = type === 'fundraiser';
  const isEvent = !isClass && !isFundraiser;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    const form = event.currentTarget;
    const formData = new FormData(form);
    const photoFile = formData.get('photo');
    const photoError = validateImageFile(photoFile);
    if (photoError) {
      setSaving(false);
      setError(photoError);
      return;
    }

    const photo = await fileToDataUrl(photoFile);
    const key = isFundraiser ? 'kb-admin-fundraisers' : isClass ? 'kb-admin-classes' : 'kb-admin-events';
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');
    const startTime = formData.get('startTime');
    const endTime = formData.get('endTime');
    const startOn = formData.get('startOn');
    const endOn = formData.get('endOn');
    const title = cleanText(formData.get('title'));
    const description = cleanText(formData.get('description'));
    const location = cleanText(formData.get('location'));
    const beneficiary = cleanText(formData.get('beneficiary'));
    const eventId = cleanText(formData.get('eventId'));
    const urlKey = cleanText(formData.get('urlKey'));

    const validationError = firstError([
      validateRequired(title, isFundraiser ? 'Cause title' : isClass ? 'Class name' : 'Event title'),
      validateRequired(description, isFundraiser ? 'Cause details' : 'Description'),
      description.length > (isFundraiser ? 520 : 320) ? `${isFundraiser ? 'Cause details' : 'Description'} is too long.` : '',
      isFundraiser ? validateRequired(beneficiary, 'Beneficiary') : '',
      isFundraiser ? validateAmount(formData.get('goal'), 'Target amount', { min: 1 }) : '',
      isFundraiser ? validateAmount(formData.get('raised'), 'Already raised', { min: 0 }) : '',
      isFundraiser ? validateRequired(formData.get('deadline'), 'Deadline') : '',
      isClass ? validateAmount(formData.get('fee'), 'Fee amount', { min: 0 }) : '',
      isClass ? validateRequired(formData.get('age'), 'Age group') : '',
      !isFundraiser ? validateRequired(location, 'Location') : '',
      isEvent ? validateRequired(urlKey, 'URL key') : '',
      isEvent ? validateRequired(formData.get('eventType'), 'Event type') : '',
      isEvent ? validateRequired(startOn, 'Start on') : '',
      isEvent ? validateRequired(endOn, 'End on') : '',
      isEvent ? validateRequired(formData.get('recurrence'), 'Recurrence') : '',
      isEvent ? validateAmount(formData.get('capacity'), 'Capacity', { min: 1 }) : '',
      isEvent ? validateDateOrder(startOn, endOn, 'Event end date cannot be before start date.') : '',
      isClass ? validateRequired(startDate, 'Start date') : '',
      isClass ? validateRequired(endDate, 'End date') : '',
      isClass ? validateRequired(startTime, 'Start time') : '',
      isClass ? validateRequired(endTime, 'End time') : '',
      isClass ? validateDateOrder(startDate, endDate, 'Class end date cannot be before start date.') : '',
      isClass ? validateTimeOrder(startTime, endTime, 'Class end time must be after start time.') : ''
    ]);

    if (validationError) {
      setSaving(false);
      setError(validationError);
      return;
    }

    if (isFundraiser && Number(formData.get('raised') || 0) > Number(formData.get('goal') || 0)) {
      setSaving(false);
      setError('Raised amount cannot be greater than target amount.');
      return;
    }

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

    const payload = isFundraiser
      ? {
          title,
          category: formData.get('category'),
          beneficiary,
          purpose: description,
          goal: Number(formData.get('goal') || 0),
          raised: Number(formData.get('raised') || 0),
          deadline: formData.get('deadline'),
          status: formData.get('status'),
          photo
        }
      : isClass
      ? {
          title,
          category: formData.get('category'),
          status: formData.get('status'),
          date: `${formatDate(startDate)} - ${formatDate(endDate)}`,
          time: `${formData.get('weekday')}, ${formatTime(startTime)} - ${formatTime(endTime)}`,
          age: formData.get('age'),
          fee: positiveAmount(formData.get('fee')),
          location,
          focus: description,
          photo
        }
      : {
          eventId,
          urlKey,
          eventType: formData.get('eventType'),
          month: formatDate(startOn),
          title,
          body: description,
          location,
          startOn,
          endOn,
          recurrence: formData.get('recurrence'),
          capacity: Number(formData.get('capacity') || 0),
          isAllDay: Boolean(formData.get('isAllDay')),
          isAgeRestricted: Boolean(formData.get('isAgeRestricted')),
          isPaymentRequired: Boolean(formData.get('isPaymentRequired')),
          enableDefaulterFine: Boolean(formData.get('enableDefaulterFine')),
          isOpenForRegistration: Boolean(formData.get('isOpenForRegistration')),
          isAutoApproved: Boolean(formData.get('isAutoApproved')),
          enabled: Boolean(formData.get('enabled')),
          displaySeatNumbers: Boolean(formData.get('displaySeatNumbers')),
          freeForVolunteers: Boolean(formData.get('freeForVolunteers')),
          enableCheckIn: Boolean(formData.get('enableCheckIn')),
          enableVolunteerDiscount: Boolean(formData.get('enableVolunteerDiscount')),
          photo
        };

    try {
      await appendAdminRecordAsync(key, payload);
      form.reset();
      setMessage(`${isFundraiser ? 'Fundraising cause' : isClass ? 'Class' : 'Event'} added successfully and saved to database.`);
      onCreated?.();
    } catch (error) {
      setError(error.message || `Could not save ${isFundraiser ? 'fundraising cause' : isClass ? 'class' : 'event'} to database.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-create-form" onSubmit={handleSubmit}>
      <h2>{isFundraiser ? 'Add fundraising cause' : isClass ? 'Add class' : 'Add event'}</h2>
      <p className="admin-form-note">
        {isFundraiser
          ? 'Create a donation cause for education, health, emergency support, or community needs.'
          : isClass
          ? 'Use date and time pickers so class cards display consistently.'
          : 'Add the complete event setup so registration, check-in, and event cards stay consistent.'}
      </p>
      <div className="admin-form-grid">
        <label>
          {isFundraiser ? 'Cause title' : isClass ? 'Class name' : 'Event title'}
          <input
            name="title"
            required
            minLength="3"
            maxLength="90"
            placeholder={isFundraiser ? 'Education support for student' : isClass ? 'Yoga / Drama / Kannada Level 7' : 'Ugadi celebration'}
          />
        </label>
        {isFundraiser && (
          <>
            <label>
              Category
              <select name="category" required defaultValue="Education">
                <option>Education</option>
                <option>Health</option>
                <option>Emergency</option>
                <option>Community</option>
                <option>Memorial</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Beneficiary / family
              <input name="beneficiary" required minLength="3" maxLength="90" placeholder="Student name / Family name" />
            </label>
            <label>
              Target amount
              <input name="goal" type="number" min="1" step="1" required placeholder="5000" />
            </label>
            <label>
              Already raised
              <input name="raised" type="number" min="0" step="1" required defaultValue="0" />
            </label>
            <label>
              Deadline
              <input name="deadline" type="date" required />
            </label>
            <label>
              Status
              <select name="status" required defaultValue="Active">
                <option>Active</option>
                <option>Paused</option>
                <option>Completed</option>
              </select>
            </label>
          </>
        )}
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
        {isEvent && (
          <>
            <label>
              Event image <small>(only jpg/jpeg/png files)</small>
              <input name="photo" type="file" accept="image/png,image/jpeg" />
            </label>
            <label>
              URL key
              <input name="urlKey" required minLength="3" maxLength="80" placeholder="kb-ugadi-2027" />
            </label>
            <label>
              Event ID
              <input name="eventId" minLength="2" maxLength="30" placeholder="Optional" />
            </label>
            <label>
              Event type
              <select name="eventType" required defaultValue="">
                <option value="" disabled>-- Please select --</option>
                <option>Classroom</option>
                <option>Workshop</option>
                <option>Seminar</option>
                <option>Cultural</option>
              </select>
            </label>
            <label>
              Start on
              <input name="startOn" type="datetime-local" required />
            </label>
            <label>
              End on
              <input name="endOn" type="datetime-local" required />
            </label>
            <label>
              Recurrence
              <select name="recurrence" required defaultValue="OneTime">
                <option>OneTime</option>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
                <option>Yearly</option>
              </select>
            </label>
            <label>
              Capacity
              <input name="capacity" type="number" min="1" step="1" required />
            </label>
          </>
        )}
        {!isFundraiser && (
          <label>
            Location
            <input name="location" required minLength="3" maxLength="120" placeholder="Bellevue / Online" />
          </label>
        )}
        {!isEvent && (
          <label>
            Photo upload
            <input name="photo" type="file" accept="image/*" />
          </label>
        )}
      </div>
      {isEvent && (
        <div className="admin-checkbox-grid">
          <label className="admin-checkbox"><input name="isAllDay" type="checkbox" /> Is all day event</label>
          <label className="admin-checkbox"><input name="isAgeRestricted" type="checkbox" /> Is age restricted</label>
          <label className="admin-checkbox"><input name="isPaymentRequired" type="checkbox" /> Is payment required</label>
          <label className="admin-checkbox"><input name="enableDefaulterFine" type="checkbox" /> Enable defaulter fine</label>
          <label className="admin-checkbox"><input name="isOpenForRegistration" type="checkbox" /> Is open for registration</label>
          <label className="admin-checkbox"><input name="isAutoApproved" type="checkbox" /> Is auto approved</label>
          <label className="admin-checkbox"><input name="enabled" type="checkbox" defaultChecked /> Enabled</label>
          <label className="admin-checkbox"><input name="displaySeatNumbers" type="checkbox" /> Display Seat Numbers</label>
          <label className="admin-checkbox"><input name="freeForVolunteers" type="checkbox" /> Free for Volunteers</label>
          <label className="admin-checkbox"><input name="enableCheckIn" type="checkbox" /> Enable for Check-in</label>
          <label className="admin-checkbox"><input name="enableVolunteerDiscount" type="checkbox" /> Enable Volunteer discount</label>
        </div>
      )}
      <label>
        {isFundraiser ? 'Cause details' : 'Description'}
        <textarea
          name="description"
          required
          minLength="10"
          maxLength={isFundraiser ? 520 : 320}
          placeholder={isFundraiser ? 'Explain why funds are being raised and how donations will help.' : isClass ? 'Short class description' : 'Event details'}
        />
      </label>
      <button className="button primary" type="submit" disabled={saving}>
        {saving ? 'Saving...' : isFundraiser ? 'Add Fundraising Cause' : isClass ? 'Add Class' : 'Add Event'}
      </button>
      {message && <p className="success">{message}</p>}
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
