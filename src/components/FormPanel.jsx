import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { appendRecord } from '../utils/storage.js';

export default function FormPanel({ type, fields, submitLabel = 'Submit', note }) {
  const [saved, setSaved] = useState(false);
  const { t } = useLanguage();

  function handleSubmit(event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const key = `kb-${type}-submissions`;
    appendRecord(key, payload);
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
      {saved && <p className="success">{t('formSaved')}</p>}
    </form>
  );
}
