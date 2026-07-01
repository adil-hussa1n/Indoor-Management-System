import React from 'react';
import { useDashboardData, useUpdateBookingStatus, useDeleteBooking } from '../hooks/useApi';
import { Loader } from '../components/ui/Loader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useSocket } from '../contexts/SocketContext';
import {
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Percent,
  FileText,
  Trash2,
  DollarSign,
  UserCheck,
} from 'lucide-react';

export const AdminDashboard = () => {
  const toast = useToast();
  const socket = useSocket();
  const [filterDate, setFilterDate] = React.useState(() => new Date().toISOString().split('T')[0]);
  const { data: dashboard, isLoading, refetch } = useDashboardData(filterDate);

  React.useEffect(() => {
    if (socket) {
      const handleRealtimeUpdate = () => {
        console.log('Realtime update: Refreshing dashboard...');
        refetch();
      };
      socket.on('slot-status-changed', handleRealtimeUpdate);
      return () => {
        socket.off('slot-status-changed', handleRealtimeUpdate);
      };
    }
  }, [socket, refetch]);
  const updateStatusMutation = useUpdateBookingStatus();
  const deleteBookingMutation = useDeleteBooking();

  const handleStatusChange = (id, newStatus) => {
    updateStatusMutation.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => {
          toast.success(`Booking status changed to ${newStatus}`);
          refetch();
        },
        onError: () => toast.error('Failed to update booking status'),
      }
    );
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      deleteBookingMutation.mutate(id, {
        onSuccess: () => {
          toast.success('Booking deleted successfully');
          refetch();
        },
        onError: () => toast.error('Failed to delete booking'),
      });
    }
  };

  // CSV Exporter
  const exportToCSV = () => {
    if (!dashboard?.recentBookings?.length) return;
    const headers = ['Booking ID,Customer Name,Phone,Email,Sport,Date,Time,Price,Status'];
    const rows = dashboard.recentBookings.map((b) =>
      `"${b.bookingId}","${b.customerName}","${b.phone}","${b.email || ''}","${b.sport}","${b.bookingDate.split('T')[0]}","${b.startTime}-${b.endTime}","${b.price}","${b.status}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + headers.concat(rows).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bookings_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) return <Loader size="large" className="py-20" />;

  const metrics = dashboard?.metrics || {};
  const recentBookings = dashboard?.recentBookings || [];

  const cards = [
    { label: "Today's Bookings", val: metrics.todayBookings, icon: <CalendarDays className="w-5 h-5 text-purple-500" />, desc: "Slots reserved for today" },
    { label: "Tomorrow's Bookings", val: metrics.tomorrowBookings, icon: <Clock className="w-5 h-5 text-indigo-500" />, desc: "Slots reserved for tomorrow" },
    { label: "Upcoming Bookings", val: metrics.upcomingBookings, icon: <UserCheck className="w-5 h-5 text-blue-500" />, desc: "Total future reservations" },
    { label: "Monthly Completed", val: metrics.completedBookings, icon: <CheckCircle className="w-5 h-5 text-emerald-500" />, desc: "Fully played sessions" },
    { label: "Monthly Revenue", val: `৳${metrics.monthlyRevenue}`, icon: <TrendingUp className="w-5 h-5 text-pink-500" />, desc: "Completed sales this month" },
    { label: "Arena Occupancy", val: `${metrics.occupancyRate}%`, icon: <Percent className="w-5 h-5 text-amber-500" />, desc: "Utilization percentage" },
  ];

  return (
    <div className="space-y-8 text-left">
      {/* Date Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-150 dark:border-zinc-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-sm text-zinc-500">Real-time venue performance overview.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 whitespace-nowrap">Filter Day:</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-650"
          />
        </div>
      </div>

      {/* Selected Day metrics */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-650">Filtered Day Performance ({new Date(filterDate).toLocaleDateString('en-BD')})</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-purple-200/40 dark:border-purple-900/20 bg-purple-50/10 dark:bg-purple-950/5">
            <CardContent className="pt-6 flex justify-between items-start">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">Day's Bookings</span>
                <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white">{metrics.selectedDateCount || 0}</h2>
                <p className="text-xs text-zinc-400">Total bookings on selected date</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center border border-purple-150/30">
                <CalendarDays className="w-5 h-5 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200/40 dark:border-purple-900/20 bg-purple-50/10 dark:bg-purple-950/5">
            <CardContent className="pt-6 flex justify-between items-start">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">Day's Revenue</span>
                <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white">৳{metrics.selectedDateRevenue || 0}</h2>
                <p className="text-xs text-zinc-400">Completed revenue on selected date</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center border border-purple-150/30">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-200/40 dark:border-purple-900/20 bg-purple-50/10 dark:bg-purple-950/5">
            <CardContent className="pt-6 flex justify-between items-start">
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">Day's Occupancy</span>
                <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white">{metrics.selectedDateOccupancy || 0}%</h2>
                <p className="text-xs text-zinc-400">Utilization of 14 hours capacity</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center border border-purple-150/30">
                <Percent className="w-5 h-5 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Overall Venue Performance</h3>
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="pt-6 flex justify-between items-start">
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{c.label}</span>
                  <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white">{c.val}</h2>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">{c.desc}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-850 flex items-center justify-center border border-zinc-150 dark:border-zinc-800">
                  {c.icon}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Analytics Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Peak Hours List */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Peak Booking Slots</CardTitle>
            <CardDescription>Most reserved hours overall</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard?.peakHours && dashboard.peakHours.length > 0 ? (
              <div className="space-y-3">
                {dashboard.peakHours.slice(0, 5).map((hour, idx) => (
                  <div key={hour._id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-sm">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-250">
                      {idx + 1}. Time Slot: {hour._id}
                    </span>
                    <span className="font-bold text-purple-650">
                      {hour.count} booking{hour.count > 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-400 text-sm">No data available yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Weekly Stats List */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Recent Daily Booking Stats</CardTitle>
            <CardDescription>Visual summary of the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard?.weeklyStats && dashboard.weeklyStats.length > 0 ? (
              <div className="space-y-4">
                {dashboard.weeklyStats.map((stat) => (
                  <div key={stat._id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs font-semibold text-zinc-500">
                      <span>{stat._id}</span>
                      <span>{stat.count} Booking(s) | ${stat.revenue} Revenue</span>
                    </div>
                    {/* Visual progress bar */}
                    <div className="w-full bg-zinc-100 dark:bg-zinc-900 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${Math.min(stat.count * 15, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-400 text-sm text-center py-6">No weekly stats loaded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Bookings Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Booking Activity</CardTitle>
            <CardDescription>Manage the latest court reservations</CardDescription>
          </div>
          <Button onClick={exportToCSV} variant="secondary" className="text-xs flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto custom-scrollbar">
          {recentBookings.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 font-semibold text-sm">
              No recent bookings found.
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-150 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider text-xs font-bold">
                  <th className="py-3 px-4">Booking ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Sport</th>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {recentBookings.map((b) => (
                  <tr key={b._id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <td className="py-3.5 px-4 font-bold text-purple-650">{b.bookingId}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{b.customerName}</div>
                      <div className="text-xs text-zinc-500">{b.phone}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium">{b.sport}</td>
                    <td className="py-3.5 px-4">
                      <div className="text-zinc-800 dark:text-zinc-200 font-semibold">{new Date(b.bookingDate).toLocaleDateString('en-BD')}</div>
                      <div className="text-xs text-zinc-500">
                        {b.startTime} - {b.endTime}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold">৳{b.price}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        b.status === 'Confirmed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                          : b.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                          : b.status === 'Completed'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
                          : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 flex items-center justify-center gap-2">
                      {b.status === 'Pending' && (
                        <Button
                          size="small"
                          variant="primary"
                          onClick={() => handleStatusChange(b._id, 'Confirmed')}
                          className="py-1 px-3 text-xs"
                        >
                          Confirm
                        </Button>
                      )}
                      {b.status === 'Confirmed' && (
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={() => handleStatusChange(b._id, 'Completed')}
                          className="py-1 px-3 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
                        >
                          Complete
                        </Button>
                      )}
                      <button
                        onClick={() => handleDelete(b._id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                        title="Delete booking"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
