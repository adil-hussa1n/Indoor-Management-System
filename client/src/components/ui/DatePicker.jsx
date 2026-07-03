import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

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
        <div className={`absolute top-[calc(100%+4px)] ${align === 'right' ? 'right-0' : 'left-0'} z-[100] w-72 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-850 bg-white dark:bg-zinc-950 shadow-xl shadow-zinc-200/50 dark:shadow-none animate-fade-in text-zinc-800 dark:text-zinc-200`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="font-extrabold text-sm">
              {monthNames[month]} {year}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-550 dark:text-zinc-400 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-550 dark:text-zinc-400 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-zinc-400 uppercase mb-2">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 text-center gap-1">
            {days.map((d, index) => {
              const isSelected = selectedDate &&
                selectedDate.getDate() === d.day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year &&
                d.isCurrentMonth;

              const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
              const isPast = min && cellDateStr < min;
              const isDisabled = !d.isCurrentMonth || isPast;

              return (
                <button
                  key={index}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleDateSelect(d.day)}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-650 text-white shadow-sm shadow-purple-500/25'
                      : isDisabled
                      ? 'text-zinc-300 dark:text-zinc-800 cursor-not-allowed opacity-40'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-350'
                  }`}
                >
                  {d.day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <span className="text-xs text-red-500 mt-0.5">{error}</span>
      )}
    </div>
  );
};
