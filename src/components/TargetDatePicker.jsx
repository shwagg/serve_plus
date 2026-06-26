import { useEffect, useRef, useState } from 'react';
import '../styles/ProjectProposal.css';

function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Shared custom calendar used for proposal and published-event target dates.
 * Omit minDate/maxDate when the date should not be restricted.
 */
export default function TargetDatePicker({ id, name, value, onChange, minDate, maxDate, required }) {
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => parseLocalDate(value || minDate));
  const pickerRef = useRef(null);
  const selectedDate = value ? parseLocalDate(value) : null;

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutsideClick = event => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const firstDayOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const calendarStart = new Date(firstDayOfMonth);
  calendarStart.setDate(1 - firstDayOfMonth.getDay());
  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedLabel = selectedDate
    ? selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Select target date';

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    const dateValue = formatDateValue(date);
    return {
      date,
      dateValue,
      isCurrentMonth: date.getMonth() === visibleMonth.getMonth(),
      isDisabled: (minDate && dateValue < minDate) || (maxDate && dateValue > maxDate),
    };
  });

  return (
    <div className="target-date-picker" ref={pickerRef}>
      <button
        type="button"
        id={id}
        className={`target-date-trigger${value ? '' : ' placeholder'}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-required={required}
        onClick={() => {
          if (!isOpen) setVisibleMonth(parseLocalDate(value || minDate));
          setIsOpen(open => !open);
        }}
      >
        <span>{selectedLabel}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        <div className="target-date-calendar" role="dialog" aria-label="Choose target date">
          <div className="target-date-calendar-header">
            <button type="button" className="calendar-nav-button" aria-label="Previous month" onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button>
            <strong>{monthLabel}</strong>
            <button type="button" className="calendar-nav-button" aria-label="Next month" onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-days">
            {days.map(({ date, dateValue, isCurrentMonth, isDisabled }) => {
              const isSelected = dateValue === value;
              return (
                <button
                  key={dateValue}
                  type="button"
                  className={`calendar-day${isDisabled ? ' disabled' : ''}${!isCurrentMonth ? ' outside-month' : ''}${isSelected ? ' selected' : ''}`}
                  disabled={isDisabled}
                  aria-label={date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  aria-pressed={isSelected}
                  onClick={() => { onChange({ target: { name, value: dateValue } }); setIsOpen(false); }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
