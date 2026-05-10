import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Feedback {
  id: string;
  booking_id: string;
  type: string;
  rating: number | null;
  feedback_text: string | null;
  issues: string | null;
  cancellation_reason: string | null;
}

interface HistoryBooking {
  id: string;
  booking_token: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  total_price: number;
  status: string;
  rooms: { room_number: string; room_type: string } | null;
  booking_feedback: Feedback[];
}

type FilterTab = 'All' | 'Completed' | 'Cancelled';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  'Completed': 'bg-teal-50 text-teal-700',
  'Cancelled':  'bg-red-50 text-red-600',
};

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

// ─── Star Rating ──────────────────────────────────────────────────────────────

const StarRow: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ color: n <= rating ? '#F59E0B' : '#CBD5E1', fontSize: 18 }}>★</span>
      ))}
    </div>
    <span className="text-sm text-amber-600 font-semibold">{RATING_LABELS[rating]}</span>
  </div>
);

const StarRowSmall: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-1">
    <div className="flex gap-px">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ color: n <= rating ? '#F59E0B' : '#CBD5E1', fontSize: 12 }}>★</span>
      ))}
    </div>
    <span className="text-xs text-amber-600 font-semibold">{RATING_LABELS[rating]}</span>
  </div>
);

// ─── Feedback Detail Modal ────────────────────────────────────────────────────

const FeedbackDetailModal: React.FC<{
  booking: HistoryBooking;
  onClose: () => void;
}> = ({ booking, onClose }) => {
  const fb = booking.booking_feedback?.[0] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl"
        style={{ border: '1px solid rgba(212,230,234,0.9)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-6 pb-5"
          style={{ borderBottom: '1px solid #F1F5F9' }}
        >
          <div>
            <h3 className="text-[17px] font-bold text-slate-800 tracking-tight">
              {booking.status === 'Completed' ? 'Stay Feedback' : 'Cancellation Details'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">{booking.guest_name}</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">{booking.booking_token}</span>
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  STATUS_STYLES[booking.status] ?? 'bg-slate-100 text-slate-600'
                }`}
              >
                {booking.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Booking summary */}
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Room</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {booking.rooms?.room_number ?? '—'}
              </p>
              {booking.rooms?.room_type && (
                <p className="text-xs text-slate-400">{booking.rooms.room_type}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dates</p>
              <p className="text-xs font-medium text-slate-700 mt-0.5">{booking.check_in}</p>
              <p className="text-xs text-slate-400">→ {booking.check_out}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {formatCurrency(booking.total_price)}
              </p>
            </div>
          </div>
        </div>

        {/* Feedback body */}
        <div className="px-6 py-5 space-y-4">
          {!fb ? (
            <div
              className="flex flex-col items-center justify-center py-8 rounded-xl"
              style={{ background: '#F5F9FA' }}
            >
              <p className="text-sm font-medium text-slate-500">No feedback submitted</p>
              <p className="text-xs text-slate-400 mt-1">The guest skipped the feedback form.</p>
            </div>
          ) : booking.status === 'Completed' ? (
            <>
              {fb.rating != null ? (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Rating
                  </p>
                  <StarRow rating={fb.rating} />
                </div>
              ) : (
                <p className="text-xs text-slate-400">No rating given.</p>
              )}

              {fb.feedback_text ? (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    How was the stay?
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed">{fb.feedback_text}</p>
                </div>
              ) : null}

              {fb.issues ? (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Issues Reported
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed">{fb.issues}</p>
                </div>
              ) : null}

              {fb.rating == null && !fb.feedback_text && !fb.issues && (
                <p className="text-sm text-slate-400">Feedback was submitted but no details were provided.</p>
              )}
            </>
          ) : (
            <>
              {fb.cancellation_reason ? (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Cancellation Reason
                  </p>
                  <div
                    className="inline-flex px-3 py-1.5 rounded-lg text-sm font-semibold text-red-700"
                    style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
                  >
                    {fb.cancellation_reason}
                  </div>
                </div>
              ) : null}

              {fb.feedback_text ? (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Additional Notes
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed">{fb.feedback_text}</p>
                </div>
              ) : null}

              {!fb.cancellation_reason && !fb.feedback_text && (
                <p className="text-sm text-slate-400">No cancellation details provided.</p>
              )}
            </>
          )}
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── History Page ─────────────────────────────────────────────────────────────

export const History: React.FC = () => {
  const [bookings, setBookings]         = useState<HistoryBooking[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState<FilterTab>('All');
  const [selectedBooking, setSelectedBooking] = useState<HistoryBooking | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Step 1: bookings only — no join that might fail if FK not configured
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*, rooms (room_number, room_type)')
          .in('status', ['Completed', 'Cancelled'])
          .order('created_at', { ascending: false });

        console.log('[History] bookings fetch:', bookingsData, bookingsError);

        if (bookingsError) throw bookingsError;
        const raw = bookingsData ?? [];

        if (raw.length === 0) {
          setBookings([]);
          return;
        }

        // Step 2: feedback fetched separately — graceful if table missing
        const ids = raw.map(b => b.id);
        const { data: feedbackData, error: feedbackError } = await supabase
          .from('booking_feedback')
          .select('*')
          .in('booking_id', ids);

        console.log('[History] feedback fetch:', feedbackData, feedbackError);

        // Index feedback by booking_id
        const feedbackMap: Record<string, Feedback[]> = {};
        for (const fb of feedbackData ?? []) {
          if (!feedbackMap[fb.booking_id]) feedbackMap[fb.booking_id] = [];
          feedbackMap[fb.booking_id].push(fb);
        }

        const merged = raw.map(b => ({
          ...b,
          booking_feedback: feedbackMap[b.id] ?? [],
        }));

        console.log('[History] merged bookings:', merged);
        setBookings(merged);
      } catch (err) {
        console.error('[History] fetch error:', err);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const counts: Record<FilterTab, number> = {
    All:       bookings.length,
    Completed: bookings.filter(b => b.status === 'Completed').length,
    Cancelled: bookings.filter(b => b.status === 'Cancelled').length,
  };

  const filtered = filter === 'All' ? bookings : bookings.filter(b => b.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div
          className="h-8 w-8 rounded-full border-2 border-roameoPrimary"
          style={{ borderTopColor: 'transparent', animation: 'spin-ring 0.75s linear infinite' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">History</h1>
        <p className="mt-1 text-sm text-slate-500">
          Completed and cancelled bookings. Click any row to view feedback.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['All', 'Completed', 'Cancelled'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={[
              'px-4 py-1.5 rounded-full text-xs font-semibold transition-all',
              filter === tab ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            ].join(' ')}
            style={
              filter === tab
                ? { background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)' }
                : undefined
            }
          >
            {tab}
            <span className="ml-1.5 opacity-70">({counts[tab]})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
          border: '1px solid rgba(212,230,234,0.6)',
        }}
      >
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm">
              {bookings.length === 0
                ? 'No completed or cancelled bookings yet.'
                : `No ${filter.toLowerCase()} bookings found.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-roameoSurface">
                  <th className="py-3.5 pl-5 pr-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Token / Guest
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Feedback
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(booking => {
                  const fb = booking.booking_feedback?.[0] ?? null;
                  const hasFeedback = fb !== null;

                  return (
                    <tr
                      key={booking.id}
                      className="hover:bg-roameoSurface/60 transition-colors cursor-pointer"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <td className="whitespace-nowrap py-4 pl-5 pr-3 text-sm">
                        <div className="font-semibold text-slate-800">{booking.booking_token}</div>
                        <div className="text-slate-400 text-xs mt-0.5">{booking.guest_name}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-700">
                        {booking.rooms?.room_number ?? '—'}
                        {booking.rooms?.room_type && (
                          <div className="text-xs text-slate-400 font-normal mt-0.5">
                            {booking.rooms.room_type}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500">
                        <div className="text-xs">
                          In: <span className="font-medium text-slate-700">{booking.check_in}</span>
                        </div>
                        <div className="text-xs mt-0.5">
                          Out: <span className="font-medium text-slate-700">{booking.check_out}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-700">
                        {formatCurrency(booking.total_price)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                            STATUS_STYLES[booking.status] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {!hasFeedback ? (
                          <span className="text-slate-300 text-xs">No feedback</span>
                        ) : booking.status === 'Completed' ? (
                          <div>
                            {fb!.rating != null && <StarRowSmall rating={fb!.rating} />}
                            {fb!.feedback_text && (
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 max-w-[140px]">
                                {fb!.feedback_text}
                              </p>
                            )}
                            {fb!.rating == null && !fb!.feedback_text && (
                              <span className="text-xs text-slate-400">Submitted</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-red-500">
                            {fb!.cancellation_reason ?? 'Submitted'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Feedback detail modal */}
      {selectedBooking && (
        <FeedbackDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
};
