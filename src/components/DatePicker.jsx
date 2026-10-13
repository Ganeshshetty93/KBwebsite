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
  const monthOnly = mode === 'month';
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const currentValue = controlled ? value || '' : internalValue;
  const selectedDate = parseDate(currentValue);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date());
  const [timeValue, setTimeValue] = useState(() => readTime(currentValue));
  const [monthPanel, setMonthPanel] = useState('months');
  const [yearPageStart, setYearPageStart] = useState(() => (selectedDate || new Date()).getFullYear() - 5);
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

  if (monthOnly) {
    const today = new Date();
    const currentMonth = toDateValue(today).slice(0, 7);
    const minMonth = min ? String(min).slice(0, 7) : '';
    const maxMonth = max ? String(max).slice(0, 7) : currentMonth;
    const viewYear = viewDate.getFullYear();
    const minYear = minMonth ? Number(minMonth.slice(0, 4)) : today.getFullYear() - 100;
    const maxYear = Number(maxMonth.slice(0, 4));
    const years = Array.from({ length: 12 }, (_item, index) => yearPageStart + index);
    const displayValue = selectedDate
      ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(selectedDate)
      : placeholder;

    function commitMonth(year, monthIndex) {
      const monthValue = `${year}-${pad(monthIndex + 1)}`;
      if ((minMonth && monthValue < minMonth) || (maxMonth && monthValue > maxMonth)) return;
      const nextValue = `${monthValue}-01`;
      if (!controlled) setInternalValue(nextValue);
      onChange?.(nextValue);
      setViewDate(new Date(year, monthIndex, 1));
      setOpen(false);
    }

    function clearMonth() {
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
          aria-haspopup="dialog"
          onClick={() => {
            setMonthPanel('months');
            setOpen((state) => !state);
          }}
        >
          <CalendarDays size={18} aria-hidden="true" />
          <span>{displayValue}</span>
        </button>
        {open && (
          <div className="kb-date-popover kb-month-popover" role="dialog" aria-label="Choose birth month and year">
            <div className="kb-date-popover-head kb-month-popover-head">
              <button
                type="button"
                aria-label={monthPanel === 'months' ? 'Previous year' : 'Previous years'}
                disabled={monthPanel === 'months' ? viewYear <= minYear : yearPageStart <= minYear}
                onClick={() => {
                  if (monthPanel === 'months') setViewDate(new Date(viewYear - 1, viewDate.getMonth(), 1));
                  else setYearPageStart((start) => Math.max(minYear, start - 12));
                }}
              ><ChevronLeft size={18} /></button>
              <button
                type="button"
                className="kb-year-switch"
                aria-label={monthPanel === 'months' ? 'Choose a year' : 'Return to month selection'}
                onClick={() => {
                  if (monthPanel === 'months') setYearPageStart(Math.max(minYear, Math.min(viewYear - 5, maxYear - 11)));
                  setMonthPanel((panel) => panel === 'months' ? 'years' : 'months');
                }}
              >
                {monthPanel === 'months' ? viewYear : `${years[0]} - ${years[years.length - 1]}`}
              </button>
              <button
                type="button"
                aria-label={monthPanel === 'months' ? 'Next year' : 'Next years'}
                disabled={monthPanel === 'months' ? viewYear >= maxYear : years[years.length - 1] >= maxYear}
                onClick={() => {
                  if (monthPanel === 'months') setViewDate(new Date(viewYear + 1, viewDate.getMonth(), 1));
                  else setYearPageStart((start) => Math.min(maxYear - 11, start + 12));
                }}
              ><ChevronRight size={18} /></button>
            </div>

            {monthPanel === 'months' ? (
              <div className="kb-month-grid">
                {Array.from({ length: 12 }, (_item, monthIndex) => {
                  const monthValue = `${viewYear}-${pad(monthIndex + 1)}`;
                  const disabled = (minMonth && monthValue < minMonth) || monthValue > maxMonth;
                  const selected = selectedDate?.getFullYear() === viewYear && selectedDate?.getMonth() === monthIndex;
                  const isCurrent = today.getFullYear() === viewYear && today.getMonth() === monthIndex;
                  return (
                    <button
                      key={monthValue}
                      type="button"
                      disabled={disabled}
                      className={[selected ? 'is-selected' : '', isCurrent ? 'is-current' : ''].filter(Boolean).join(' ')}
                      onClick={() => commitMonth(viewYear, monthIndex)}
                    >
                      <span>{new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(viewYear, monthIndex, 1))}</span>
                      <small>{new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(viewYear, monthIndex, 1))}</small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="kb-year-grid">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    disabled={year < minYear || year > maxYear}
                    className={[year === viewYear ? 'is-selected' : '', year === today.getFullYear() ? 'is-current' : ''].filter(Boolean).join(' ')}
                    onClick={() => {
                      setViewDate(new Date(year, viewDate.getMonth(), 1));
                      setMonthPanel('months');
                    }}
                  >{year}</button>
                ))}
              </div>
            )}

            <div className="kb-date-actions kb-month-actions">
              <button type="button" onClick={clearMonth}><X size={14} /> Clear</button>
              <button type="button" onClick={() => commitMonth(today.getFullYear(), today.getMonth())}>This month</button>
            </div>
          </div>
        )}
      </div>
    );
  }

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
