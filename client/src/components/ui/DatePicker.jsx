import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendarAvailability } from '../../hooks/useApi';

export const DatePicker = ({
  label,
  value, // Expects 'YYYY-MM-DD'
  onChange,
  error,
  min, // Expects 'YYYY-MM-DD'
  align = 'left',
  className = '',
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse current date or use today
  const selectedDate = value ? new Date(value) : null;
  
  // Track month/year currently viewed in calendar
  const [viewDate, setViewDate] = useState(() => {
    return selectedDate ? new Date(selectedDate) : new Date();
  });

  // Sync viewDate when value changes externally
  useEffect(() => {
    if (value) {
      setViewDate(new Date(value));
    }
  }, [value]);

  // Format display value as DD/MM/YYYY
  const getDisplayValue = () => {
    if (!value) return '';
    const date = new Date(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calendar math
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const { data: availability } = useCalendarAvailability(isOpen ? year : null, isOpen ? month + 1 : null);

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleDateSelect = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  // Generate days array
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const days = [];
  // Previous month's trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    days.push({ day: prevMonthTotalDays - i, isCurrentMonth: false });
  }
  // Current month's days
  for (let i = 1; i <= totalDays; i++) {
    days.push({ day: i, isCurrentMonth: true });
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div ref={containerRef} className={`flex flex-col gap-1.5 w-full text-left relative ${isOpen ? 'z-[100]' : 'z-10'}`}>
      {label && (
        <label className="text-xs font-semibold text-zinc-655 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          placeholder="DD/MM/YYYY"
          readOnly
          onClick={() => setIsOpen(!isOpen)}
          value={getDisplayValue()}
          className={`w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-955 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer ${
            error ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''
          } ${className}`}
          {...props}
        />
        <CalendarIcon
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-455 dark:text-zinc-600 cursor-pointer"
        />
      </div>

      {isOpen && (
        <div className={`absolute top-[calc(100%+6px)] ${align === 'right' ? 'right-0' : 'left-0'} z-[100] w-[296px] p-4.5 rounded-3xl border border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950 shadow-2xl shadow-zinc-200/60 dark:shadow-none animate-fade-in text-zinc-800 dark:text-zinc-200`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="font-extrabold text-sm text-zinc-800 dark:text-zinc-100">
              {monthNames[month]} {year}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl border border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl border border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2.5">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 text-center gap-1.5">
            {days.map((d, index) => {
              const isSelected = selectedDate &&
                selectedDate.getDate() === d.day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year &&
                d.isCurrentMonth;

              const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
              const isPast = min && cellDateStr < min;
              const isDisabled = !d.isCurrentMonth || isPast;
              const status = availability ? availability[cellDateStr] : null;

              return (
                <button
                  key={index}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleDateSelect(d.day)}
                  className={`w-9 h-9 flex flex-col items-center justify-center text-xs font-semibold rounded-full transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                      : isDisabled
                      ? 'text-zinc-300 dark:text-zinc-800 cursor-not-allowed opacity-35'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <span className={status && !isDisabled ? 'translate-y-[-1px]' : ''}>{d.day}</span>
                  {!isDisabled && status && (
                    <span className={`w-1 h-1 rounded-full absolute bottom-1.5 ${
                      isSelected
                        ? 'bg-white' // High contrast white dot when day is selected
                        : status === 'green'
                        ? 'bg-emerald-500'
                        : status === 'yellow'
                        ? 'bg-amber-500'
                        : status === 'red'
                        ? 'bg-rose-500'
                        : 'bg-zinc-400'
                    }`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex justify-center items-center gap-4 pt-3.5 mt-3.5 border-t border-zinc-100 dark:border-zinc-900/80 text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Available</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Booked</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Full</span>
          </div>
        </div>
      )}

      {error && (
        <span className="text-xs text-red-500 mt-0.5">{error}</span>
      )}
    </div>
  );
};
