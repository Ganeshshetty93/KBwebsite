import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { appendRecord } from '../utils/storage.js';
import { cleanText, firstError, validateEmail, validateRequired } from '../utils/validation.js';

export default function FormPanel({ type, fields, submitLabel = 'Submit', note }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLanguage();

  function handleSubmit(event) {
    event.preventDefault();
    setSaved(false);
    setError('');
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const validationError = firstError(fields.map((field) => {
      const value = payload[field.name];
      if (field.required && field.type === 'email') return validateEmail(value);
      if (field.required) return validateRequired(value, field.label);
      if (field.type === 'email' && cleanText(value)) return validateEmail(value);
      return '';
    }));

    if (validationError) {
      setError(validationError);
      return;
    }

    const key = `kb-${type}-submissions`;
    appendRecord(key, Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, cleanText(value)])));
    event.currentTarget.reset();
    setSaved(true);
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      {fields.map((field) => (
        <label key={field.name}>
          {field.label}
          {field.type === 'textarea' ? (
            <textarea name={field.name} placeholder={field.placeholder} required={field.required} />
          ) : field.type === 'select' ? (
            <select name={field.name} required={field.required} defaultValue={field.defaultValue || ''}>
              <option value="">Choose one</option>
              {field.options.map((option) => <option key={option}>{option}</option>)}
            </select>
          ) : (
            <input name={field.name} type={field.type || 'text'} placeholder={field.placeholder} required={field.required} defaultValue={field.defaultValue || ''} />
          )}
        </label>
      ))}
      <button className="button primary" type="submit">{submitLabel}</button>
      {note && <p className="fine-print">{note}</p>}
      {error && <p className="form-error">{error}</p>}
      {saved && <p className="success">{t('formSaved')}</p>}
    </form>
  );
}
