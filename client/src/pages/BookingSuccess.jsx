import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Calendar, Clock, MapPin, User, CreditCard, Printer, ArrowRight, ShieldCheck, Download, Award } from 'lucide-react';
import API from '../services/api';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { usePublicSettings } from '../hooks/useApi';

const format12Hour = (time24) => {
  if (!time24 || typeof time24 !== 'string') return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  let hour = parseInt(parts[0], 10);
  if (isNaN(hour)) return time24;
  const minStr = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  return `${String(hour).padStart(2, '0')}:${minStr} ${ampm}`;
};

const formatDateDisplay = (dateStr, options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-GB', options);
  } catch (e) {
    return String(dateStr);
  }
};

export const BookingSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('bookingId');

  const { data: settings } = usePublicSettings();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    const fetchBooking = async () => {
      try {
        const res = await API.get(`/public/booking/${bookingId}`);
        if (res.data.success && res.data.booking) {
          setBooking(res.data.booking);
        } else {
          setError('Booking record not found.');
        }
      } catch (err) {
        console.error('Error fetching booking via public route, attempting fallback:', err);
        try {
          const fallbackRes = await API.get(`/bookings/${bookingId}`);
          if (fallbackRes.data.success && fallbackRes.data.booking) {
            setBooking(fallbackRes.data.booking);
            return;
          }
        } catch (e2) {
          console.error('Fallback fetch error:', e2);
        }
        setError('Failed to load booking details.');
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <Loader size="lg" />
        <p className="text-sm font-bold text-zinc-500 animate-pulse">Loading Official Booking Invoice...</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 glass-card rounded-3xl text-center space-y-4">
        <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Booking Not Found</h2>
        <p className="text-xs text-zinc-500">{error || 'Could not locate your reservation details.'}</p>
        <Button onClick={() => navigate('/booking')} className="w-full font-bold">
          Return to Booking Page
        </Button>
      </div>
    );
  }

  const businessName = settings?.businessName || 'Indoor Sports Complex';
  const businessPhone = settings?.contactPhone || '01700000000';
  const businessEmail = settings?.contactEmail || 'contact@indoorsports.com';

  const bookingRefId = booking.bookingId || booking.id || booking._id || 'N/A';
  const isPaid = booking.paymentStatus === 'paid';
  const isPartial = booking.paymentStatus === 'partial';

  const rawGateway = (booking.paymentGateway || '').toLowerCase();
  const hasOnlineGatewayMethod = rawGateway && !['cash', 'pay at venue', 'direct', 'venue', 'manual', 'offline'].includes(rawGateway);
  const paymentMethodLabel = booking.paymentGateway || (hasOnlineGatewayMethod ? 'Online Gateway' : 'Pay at Venue / Cash');

  const paidAmount = Number(booking.paidAmount || 0);
  const totalPrice = Number(booking.price || 0);
  const dueAmount = booking.dueAmount !== undefined ? Number(booking.dueAmount) : Math.max(0, totalPrice - paidAmount);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-left animate-fade-in print:p-0 print:m-0 print:max-w-none">
      
      {/* Action Header for Screen View */}
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden bg-white/80 dark:bg-zinc-900/80 p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-zinc-900 dark:text-white">Booking Receipt Verified</h2>
            <p className="text-xs text-zinc-500">Official receipt ready to view or print.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button type="button" variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none font-bold text-xs flex items-center gap-1.5 py-2.5">
            <Printer className="w-4 h-4 text-purple-650" /> Print / Save Invoice
          </Button>
          <Button type="button" onClick={() => navigate('/booking')} className="flex-1 sm:flex-none font-bold text-xs bg-purple-650 hover:bg-purple-700 text-white flex items-center gap-1.5 py-2.5">
            Book Another Court <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Official A4 Printable Invoice Sheet */}
      <div id="printable-invoice" className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8 sm:p-12 rounded-3xl border border-zinc-200 dark:border-zinc-850 shadow-2xl space-y-8 print:p-8 print:shadow-none print:border-none print:rounded-none print:text-black print:bg-white">
        
        {/* Invoice Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start border-b border-zinc-200 dark:border-zinc-800 pb-6 gap-6 print:flex-row">
          <div className="space-y-1.5">
            {settings?.logo ? (
              <img src={settings.logo} alt="Logo" className="h-10 object-contain mb-2" />
            ) : null}
            <h1 className="text-2xl font-black tracking-tight text-purple-650 dark:text-purple-400 uppercase print:text-black">
              {businessName}
            </h1>
            <p className="text-xs font-semibold text-zinc-500">Premium Indoor Sports & Arena Facility</p>
            <div className="text-xs font-mono text-zinc-450 space-y-0.5 pt-1">
              <div>Phone: {businessPhone}</div>
              <div>Email: {businessEmail}</div>
            </div>
          </div>

          <div className="sm:text-right space-y-1 print:text-right">
            <div className="inline-block px-3 py-1 bg-purple-500/10 text-purple-650 dark:text-purple-300 font-extrabold text-xs uppercase tracking-wider rounded-lg print:border print:border-purple-600">
              Official Tax Invoice
            </div>
            <div className="text-lg font-black font-mono pt-1 text-zinc-900 dark:text-white print:text-black">
              #{bookingRefId}
            </div>
            <div className="text-xs font-mono text-zinc-500">
              Issued Date: {formatDateDisplay(booking.createdAt || Date.now(), { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <div className="pt-2">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                isPaid
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 print:border print:border-emerald-600'
                  : isPartial
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 print:border print:border-indigo-600'
              }`}>
                {isPaid ? '✓ PAID IN FULL' : isPartial ? 'PARTIAL DEPOSIT PAID' : 'CONFIRMED (PAY AT VENUE)'}
              </span>
            </div>
          </div>
        </div>

        {/* Billed To & Arena Info Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs print:grid-cols-2">
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-150 dark:border-zinc-800 space-y-2 print:border print:border-zinc-300 print:bg-zinc-50">
            <h3 className="font-extrabold uppercase text-[10px] tracking-widest text-purple-650 dark:text-purple-400 print:text-black">
              👤 Billed To Customer
            </h3>
            <div className="text-sm font-bold text-zinc-900 dark:text-white print:text-black">
              {booking.customerName || 'Customer'}
            </div>
            <div className="text-zinc-600 dark:text-zinc-400 font-medium">
              Phone: {booking.phone || 'N/A'}
            </div>
            {booking.email && (
              <div className="text-zinc-600 dark:text-zinc-400 font-medium">
                Email: {booking.email}
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-150 dark:border-zinc-800 space-y-2 print:border print:border-zinc-300 print:bg-zinc-50">
            <h3 className="font-extrabold uppercase text-[10px] tracking-widest text-purple-650 dark:text-purple-400 print:text-black">
              🏟️ Arena & Match Schedule
            </h3>
            <div className="text-sm font-bold text-zinc-900 dark:text-white print:text-black">
              {booking.ground?.name || 'Main Arena'} ({booking.sport || 'Sports'})
            </div>
            <div className="text-zinc-600 dark:text-zinc-400 font-semibold">
              Date: {formatDateDisplay(booking.bookingDate)}
            </div>
            <div className="text-zinc-600 dark:text-zinc-400 font-semibold">
              Time: {format12Hour(booking.startTime)} - {format12Hour(booking.endTime)} ({booking.duration || 1} hr)
            </div>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-zinc-200 dark:border-zinc-800 text-zinc-500 font-extrabold uppercase tracking-wider text-[10px] print:border-black">
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Schedule</th>
                <th className="py-3 px-3 text-center">Duration</th>
                <th className="py-3 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850 font-medium">
              <tr>
                <td className="py-4 px-3">
                  <div className="font-bold text-zinc-900 dark:text-white print:text-black text-sm">
                    {booking.ground?.name || 'Main Arena'} Court Reservation
                  </div>
                  <div className="text-[11px] text-zinc-500">Sport: {booking.sport || 'Sports'} &bull; Ref: {bookingRefId}</div>
                </td>
                <td className="py-4 px-3 text-zinc-700 dark:text-zinc-300">
                  <div>{booking.bookingDate}</div>
                  <div className="text-[11px] text-purple-650 font-bold">{format12Hour(booking.startTime)} - {format12Hour(booking.endTime)}</div>
                </td>
                <td className="py-4 px-3 text-center font-bold text-zinc-800 dark:text-zinc-200">
                  {booking.duration || 1} hr{(booking.duration || 1) > 1 ? 's' : ''}
                </td>
                <td className="py-4 px-3 text-right font-mono font-bold text-sm text-zinc-900 dark:text-white print:text-black">
                  ৳{totalPrice}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment Summary Box */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t-2 border-zinc-200 dark:border-zinc-800 pt-6 print:flex-row print:border-black">
          {/* Payment Verification / Mode Badge */}
          <div className="space-y-2 max-w-xs text-xs">
            <div className="font-extrabold text-zinc-400 uppercase tracking-widest text-[10px]">
              {hasOnlineGatewayMethod ? 'Payment Verification' : 'Reservation Payment Mode'}
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 font-mono font-semibold space-y-1 print:border print:border-purple-600">
              <div>Method: <strong className="uppercase">{paymentMethodLabel}</strong></div>
              {booking.transactionId && <div>TrxID: <strong>{String(booking.transactionId)}</strong></div>}
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                {hasOnlineGatewayMethod ? '✓ Online Transaction Verified' : '✓ Slot Reservation Confirmed'}
              </div>
            </div>
          </div>

          {/* Pricing Totals */}
          <div className="w-full sm:w-64 space-y-2 text-xs font-semibold">
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Subtotal:</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white print:text-black">৳{totalPrice}</span>
            </div>
            {paidAmount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>{hasOnlineGatewayMethod ? 'Paid Online:' : 'Amount Paid:'}</span>
                <span className="font-mono font-bold">৳{paidAmount}</span>
              </div>
            )}
            {dueAmount > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>Due at Venue:</span>
                <span className="font-mono font-bold">৳{dueAmount}</span>
              </div>
            )}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2 flex justify-between text-base font-black text-purple-650 dark:text-purple-400 print:text-black">
              <span>{paidAmount > 0 ? 'Total Paid:' : 'Payable at Venue:'}</span>
              <span className="font-mono">৳{paidAmount > 0 ? paidAmount : dueAmount}</span>
            </div>
          </div>
        </div>

        {/* Invoice Footer Terms & Signature Line */}
        {(() => {
          const pConfig = settings?.paymentConfig || {};
          const termsText = pConfig.invoiceTerms || '1. Please present this invoice at venue check-in.\n2. Proper sports gear and non-marking shoes required.\n3. Non-refundable unless cancelled 24 hours prior.';
          const termsLines = typeof termsText === 'string' ? termsText.split('\n').filter(Boolean) : [];

          const sigName = pConfig.authorizedSignatoryName || 'Authorized Signature';
          const sigTitle = pConfig.authorizedSignatoryTitle || 'Venue Manager / Management';
          const sigImage = pConfig.authorizedSignatureImage || '';

          return (
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 flex flex-col sm:flex-row justify-between items-end gap-6 text-[10px] text-zinc-500 print:flex-row">
              <div className="space-y-1 max-w-sm">
                <div className="font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider text-[9px] print:text-black">
                  Terms & Rules
                </div>
                {termsLines.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>

              <div className="text-center sm:text-right space-y-2 print:text-right">
                {sigImage ? (
                  <img src={sigImage} alt="Signature" className="h-12 object-contain ml-auto mb-1 print:h-10" />
                ) : (
                  <div className="border-b border-zinc-400 dark:border-zinc-600 w-44 ml-auto mb-2" />
                )}
                <div className="font-extrabold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider text-[10px] print:text-black">
                  {sigName}
                </div>
                <div className="text-[9px] text-zinc-400 font-semibold">
                  {sigTitle}
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
};
