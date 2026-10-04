import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateValue(date) {
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(value) {
  if (!value) return null;
  const [datePart] = String(value).split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toInputValue(dateValue, timeValue, includeTime) {
  if (!dateValue) return '';
  return includeTime ? `${dateValue}T${timeValue || '09:00'}` : dateValue;
}

function readTime(value) {
  if (!value || !String(value).includes('T')) return '09:00';
  return String(value).split('T')[1]?.slice(0, 5) || '09:00';
}

function sameDay(left, right) {
  return left && right && left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export default function DatePicker({
  name,
  label,
  value,
  defaultValue = '',
  onChange,
  required = false,
  mode = 'date',
  placeholder = 'Select date',
  min,
  max,
  quickOptions = []
}) {
  const includeTime = mode === 'datetime';
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const currentValue = controlled ? value || '' : internalValue;
  const selectedDate = parseDate(currentValue);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date());
  const [timeValue, setTimeValue] = useState(() => readTime(currentValue));
  const rootRef = useRef(null);

  useEffect(() => {
    if (selectedDate) setViewDate(selectedDate);
    setTimeValue(readTime(currentValue));
  }, [currentValue]);

  useEffect(() => {
    function handleClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    const form = rootRef.current?.closest('form');
    if (!form || controlled) return undefined;
    function handleReset() {
      window.setTimeout(() => setInternalValue(defaultValue || ''), 0);
    }
    form.addEventListener('reset', handleReset);
    return () => form.removeEventListener('reset', handleReset);
  }, [controlled, defaultValue]);

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_item, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [viewDate]);

  const displayValue = currentValue
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {})
      }).format(new Date(includeTime ? currentValue : `${currentValue}T00:00:00`))
    : placeholder;

  function commit(nextDate, nextTime = timeValue) {
    const nextValue = toInputValue(toDateValue(nextDate), nextTime, includeTime);
    if (!controlled) setInternalValue(nextValue);
    onChange?.(nextValue);
  }

  function shiftMonth(amount) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  function setToday() {
    const today = new Date();
    setViewDate(today);
    commit(today);
    setOpen(false);
  }

  function setOffset(offsetDays) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + offsetDays);
    setViewDate(nextDate);
    commit(nextDate);
    setOpen(false);
  }

  function clear() {
    if (!controlled) setInternalValue('');
    onChange?.('');
    setOpen(false);
  }

  return (
    <div className="kb-date-picker" ref={rootRef}>
      {label && <span className="kb-date-label">{label}</span>}
      {name && <input type="hidden" name={name} value={currentValue} required={required} />}
      <button
        className={currentValue ? 'kb-date-trigger has-value' : 'kb-date-trigger'}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
      >
        <CalendarDays size={18} />
        <span>{displayValue}</span>
      </button>
      {open && (
        <div className="kb-date-popover">
          <div className="kb-date-popover-head">
            <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={18} /></button>
            <strong>{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(viewDate)}</strong>
            <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={18} /></button>
          </div>
          <div className="kb-date-weekdays">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="kb-date-grid">
            {weeks.map((date) => {
              const dateValue = toDateValue(date);
              const disabled = (min && dateValue < min) || (max && dateValue > max);
              return (
                <button
                  key={dateValue}
                  type="button"
                  disabled={disabled}
                  className={[
                    date.getMonth() !== viewDate.getMonth() ? 'is-muted' : '',
                    sameDay(date, selectedDate) ? 'is-selected' : '',
                    sameDay(date, new Date()) ? 'is-today' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    commit(date);
                    if (!includeTime) setOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          {includeTime && (
            <label className="kb-time-row">
              <Clock size={16} />
              <span>Time</span>
              <input
                type="time"
                value={timeValue}
                onChange={(event) => {
                  setTimeValue(event.target.value);
                  if (selectedDate) commit(selectedDate, event.target.value);
                }}
              />
            </label>
          )}
          <div className="kb-date-actions">
            <button type="button" onClick={clear}><X size={14} /> Clear</button>
            {quickOptions.map((option) => (
              <button key={`${option.label}-${option.offsetDays}`} type="button" onClick={() => setOffset(option.offsetDays || 0)}>
                {option.label}
              </button>
            ))}
            <button type="button" onClick={setToday}>Today</button>
            {includeTime && <button type="button" className="primary" onClick={() => setOpen(false)}>Done</button>}
          </div>
        </div>
      )}
    </div>
  );
}
