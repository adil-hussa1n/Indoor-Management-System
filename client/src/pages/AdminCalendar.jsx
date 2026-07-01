import React, { useState } from 'react';
import { useAdminBookings } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Loader } from '../components/ui/Loader';
import { CalendarDays, Clock, User } from 'lucide-react';

export const AdminCalendar = () => {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const { data: bookingData, isLoading } = useAdminBookings({
    startDate: selectedDate,
    endDate: selectedDate,
    limit: 50,
  });

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const statusColors = {
    Pending: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/10 text-amber-800 dark:text-amber-400',
    Confirmed: 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-400',
    Completed: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/10 text-blue-800 dark:text-blue-400',
    Cancelled: 'border-l-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/10 text-zinc-650 dark:text-zinc-450',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left">
      {/* Date Picker Card */}
      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-purple-650" />
            Pick Calendar Date
          </CardTitle>
          <CardDescription>Select any date to view all bookings.</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </CardContent>
      </Card>

      {/* Bookings List Card */}
      <Card className="lg:col-span-8">
        <CardHeader>
          <CardTitle>Schedule for {selectedDate}</CardTitle>
          <CardDescription>All scheduled court slots for this day.</CardDescription>
        </CardHeader>
        <CardContent>
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
                  className={`p-4 rounded-xl border-l-4 border border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${statusColors[booking.status] || 'border-l-zinc-300'}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold tracking-wider text-xs uppercase px-2 py-0.5 rounded bg-zinc-200/50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {booking.sport}
                      </span>
                      <span className="text-xs font-bold text-zinc-400">
                        {booking.bookingId}
                      </span>
                    </div>
                    <h4 className="font-bold text-base flex items-center gap-1.5">
                      <User className="w-4 h-4 opacity-70" />
                      {booking.customerName}
                    </h4>
                    <p className="text-xs opacity-75">
                      Phone: {booking.phone} {booking.email ? `| Email: ${booking.email}` : ''}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-zinc-150 pt-2 sm:pt-0">
                    <div className="flex items-center gap-1.5 text-sm font-extrabold text-purple-650">
                      <Clock className="w-4 h-4" />
                      {booking.startTime} - {booking.endTime}
                    </div>
                    <div className="text-xs font-semibold opacity-75">
                      {booking.duration} hr{booking.duration > 1 ? 's' : ''} &bull; ৳{booking.price}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
