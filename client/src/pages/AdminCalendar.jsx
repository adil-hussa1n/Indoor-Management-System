import React, { useState } from 'react';
import { useAdminBookings, useGrounds } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Loader } from '../components/ui/Loader';
import { CalendarDays, Clock, User, Layers } from 'lucide-react';
import { DatePicker } from '../components/ui/DatePicker';

const format12Hour = (time24) => {
  if (!time24) return '';
  const [hourStr, minStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  const displayHour = String(hour).padStart(2, '0');
  return `${displayHour}:${minStr} ${ampm}`;
};

const formatDateDMY = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const AdminCalendar = () => {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const { data: grounds } = useGrounds();
  const [selectedGroundIds, setSelectedGroundIds] = useState([]);

  const groundIdQueryParam = selectedGroundIds.length === 0
    ? undefined
    : selectedGroundIds.join(',');

  const { data: bookingData, isLoading } = useAdminBookings({
    startDate: selectedDate,
    endDate: selectedDate,
    limit: 50,
    groundId: groundIdQueryParam,
  });

  const handleDateChange = (dateStr) => {
    setSelectedDate(dateStr);
  };

  const handleToggleGround = (id) => {
    const idStr = id.toString();
    if (selectedGroundIds.includes(idStr)) {
      setSelectedGroundIds(selectedGroundIds.filter(gId => gId !== idStr));
    } else {
      setSelectedGroundIds([...selectedGroundIds, idStr]);
    }
  };

  const handleSelectAllGrounds = () => {
    setSelectedGroundIds([]);
  };

  const statusColors = {
    Pending: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/10 text-amber-800 dark:text-amber-400',
    Confirmed: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-400',
    Completed: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/10 text-blue-800 dark:text-blue-400',
    Cancelled: 'border-l-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/10 text-zinc-650 dark:text-zinc-450',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left animate-fade-in">
      {/* Date Picker Card */}
      <div className="lg:col-span-4 glass-card p-6 rounded-3xl shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-purple-650" />
            Pick Calendar Date
          </h3>
          <p className="text-xs text-zinc-455 mt-1">Select any date to view all bookings.</p>
        </div>
        <DatePicker
          value={selectedDate}
          onChange={handleDateChange}
          className="w-full"
        />

        {grounds && grounds.length > 0 && (
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-zinc-450 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-purple-650" /> Filter Arenas ({selectedGroundIds.length === 0 ? 'All' : `${selectedGroundIds.length} Selected`})
              </label>
              {selectedGroundIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllGrounds}
                  className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                >
                  Clear Filter
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleSelectAllGrounds}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  selectedGroundIds.length === 0
                    ? 'bg-purple-650 border-purple-650 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400 hover:border-purple-300'
                }`}
              >
                All Arenas
              </button>
              {grounds.map((g) => {
                const isSelected = selectedGroundIds.includes(g.id.toString());
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleToggleGround(g.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-purple-650 border-purple-650 text-white shadow-sm ring-1 ring-purple-500/30'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400 hover:border-purple-300'
                    }`}
                  >
                    <span>{g.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-md uppercase font-mono ${
                      isSelected ? 'bg-purple-500/30 text-white' : 'bg-purple-500/10 text-purple-650 dark:text-purple-400'
                    }`}>
                      {g.sport}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bookings List Card */}
      <div className="lg:col-span-8 glass-card p-6 rounded-3xl shadow-sm space-y-4">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Schedule for {formatDateDMY(selectedDate)}</h3>
          <p className="text-xs text-zinc-455 mt-1">All scheduled court slots for this day.</p>
        </div>
        <div>
          {isLoading ? (
            <Loader size="medium" className="py-12" />
          ) : !bookingData?.bookings || bookingData.bookings.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 font-semibold border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              No bookings scheduled for this date.
            </div>
          ) : (
            <div className="space-y-4">
              {bookingData.bookings.map((booking) => (
                <div
                  key={booking._id}
                  className={`p-4 rounded-xl border-l-4 border border-zinc-200 dark:border-zinc-850 hover-glow flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${statusColors[booking.status] || 'border-l-zinc-300'}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold tracking-wider text-[10px] uppercase px-2 py-0.5 rounded bg-zinc-200/50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-sans">
                        {booking.sport}
                      </span>
                      {booking.ground && (
                        <span className="font-extrabold tracking-wider text-[10px] uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-550 dark:text-purple-400 border border-purple-500/20 font-mono">
                          {booking.ground.name}
                        </span>
                      )}
                      <span className="text-xs font-bold text-zinc-450">
                        {booking.bookingId}
                      </span>
                    </div>
                    <h4 className="font-bold text-base flex items-center gap-1.5 mt-1 text-zinc-900 dark:text-white">
                      <User className="w-4 h-4 opacity-70 text-zinc-500" />
                      {booking.customerName}
                    </h4>
                    <p className="text-xs opacity-75 font-semibold text-zinc-500">
                      Phone: {booking.phone} {booking.email ? `| Email: ${booking.email}` : ''}
                    </p>
                  </div>

                    <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-zinc-150 pt-2 sm:pt-0">
                      <div className="flex items-center gap-1.5 text-sm font-extrabold text-purple-650">
                        <Clock className="w-4 h-4" />
                        {format12Hour(booking.startTime)} - {format12Hour(booking.endTime)}
                      </div>
                      <div className="text-xs font-semibold opacity-75 mt-0.5">
                        {booking.duration} hr{booking.duration > 1 ? 's' : ''} &bull; Total: ৳{booking.price}
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          booking.paymentStatus === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : booking.paymentStatus === 'partial'
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                            : booking.paymentStatus === 'refunded'
                            ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                            : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                        }`}>
                          💳 {booking.paymentStatus || 'unpaid'}
                        </span>
                        <span className="text-[10px] font-mono font-bold opacity-80">
                          Paid: ৳{booking.paidAmount || 0} {booking.dueAmount > 0 ? `| Due: ৳${booking.dueAmount}` : ''}
                        </span>
                      </div>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

