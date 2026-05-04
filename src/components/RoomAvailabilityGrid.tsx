import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, generateBookingToken } from '../lib/utils';
import { X, ChevronLeft, ChevronRight, Calendar, AlertCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomRow {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
  status: string;
}

interface GridBooking {
  id: string;
  room_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  status: string;
}

type BaseStatus = 'available' | 'today' | 'checkin' | 'reserved' | 'checkout' | 'past' | 'maintenance';
type CellStatus = BaseStatus | 'selecting';

interface DragState {
  active: boolean;
  roomId: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface ModalData {
  room: RoomRow;
  checkIn: string;
  checkOut: string;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

function diffDays(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime()) / 86400000,
  );
}

function makeDateRange(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

function headerFor(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  const dow = d.getUTCDay();
  return {
    dayNum: String(d.getUTCDate()).padStart(2, '0'),
    dayName: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dow],
    monthShort: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    isWeekend: dow === 0 || dow === 6,
    isFirst: d.getUTCDate() === 1,
  };
}

function periodLabel(dates: string[]): string {
  if (!dates.length) return '';
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(iso + 'T12:00:00Z').toLocaleString('en-US', { timeZone: 'UTC', ...opts });
  return `${fmt(dates[0], { month: 'long', day: 'numeric' })} – ${fmt(dates[dates.length - 1], { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

// ─── Grid constants ───────────────────────────────────────────────────────────

const DAYS = 30;
const CELL_W = 52;   // px per date column
const ROOM_W = 176;  // px for the sticky room-name column

// ─── Cell visual config ───────────────────────────────────────────────────────

const CELL_BASE =
  'flex-shrink-0 flex items-center justify-center text-[10px] font-bold select-none border-r border-b border-slate-100 transition-colors duration-75';

const CELL_CLASSES: Record<CellStatus, string> = {
  available:   `${CELL_BASE} bg-emerald-50   hover:bg-emerald-100  cursor-crosshair  text-emerald-600`,
  today:       `${CELL_BASE} bg-emerald-100  hover:bg-emerald-200  cursor-crosshair  text-emerald-700  ring-1 ring-inset ring-emerald-300`,
  checkin:     `${CELL_BASE} bg-amber-100    cursor-default        text-amber-700`,
  reserved:    `${CELL_BASE} bg-red-100      cursor-not-allowed    text-red-500`,
  checkout:    `${CELL_BASE} bg-amber-50     hover:bg-emerald-50   cursor-crosshair  text-amber-500`,
  past:        `${CELL_BASE} bg-slate-50     cursor-default        text-slate-300`,
  maintenance: `${CELL_BASE} bg-slate-100    cursor-not-allowed    text-slate-400`,
  selecting:   `${CELL_BASE} bg-blue-200     cursor-crosshair      text-blue-700     ring-1 ring-inset ring-blue-400`,
};

const CELL_LABELS: Partial<Record<CellStatus, string>> = {
  checkin:     'IN',
  checkout:    'OUT',
  reserved:    '●',
  maintenance: 'M',
};

// ─── BookingModal ─────────────────────────────────────────────────────────────

interface BookingModalProps {
  data: ModalData;
  onClose: () => void;
  onSuccess: (b: GridBooking) => void;
}

const BookingModal: React.FC<BookingModalProps> = ({ data, onClose, onSuccess }) => {
  const { room, checkIn, checkOut } = data;
  const nights = diffDays(checkIn, checkOut);
  const totalPrice = nights * room.price;

  const [form, setForm] = useState({
    guestName: '',
    phone: '',
    cnic: '',
    advance: +(totalPrice * 0.2).toFixed(2),
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: key === 'advance' ? +e.target.value : e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.guestName.trim()) return setError('Guest name is required');
    if (!form.phone.trim()) return setError('Phone number is required');
    setSubmitting(true);

    const base: Record<string, unknown> = {
      booking_token: generateBookingToken(),
      guest_name: form.guestName.trim(),
      room_id: room.id,
      check_in: checkIn,
      check_out: checkOut,
      total_price: totalPrice,
      status: 'Confirmed',
    };

    const doInsert = async (payload: Record<string, unknown>) => {
      const { data: row, error: err } = await supabase
        .from('bookings')
        .insert([payload])
        .select('id')
        .single();
      return { row, err };
    };

    try {
      // Attempt with extended fields; fall back if columns don't exist yet
      let { row, err } = await doInsert({
        ...base,
        guest_phone: form.phone.trim(),
        guest_cnic: form.cnic.trim(),
        advance_payment: form.advance,
      });

      if (err && err.message?.includes('column')) {
        ({ row, err } = await doInsert(base));
      }

      if (err) throw err;

      onSuccess({
        id: row!.id,
        room_id: room.id,
        guest_name: form.guestName,
        check_in: checkIn,
        check_out: checkOut,
        status: 'Confirmed',
      });
    } catch (ex: any) {
      setError(ex.message ?? 'Failed to save booking');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
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
            <h3 className="text-[17px] font-bold text-slate-800 tracking-tight">New Booking</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Room {room.room_number} · {room.room_type}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Date summary bar */}
        <div
          className="mx-6 my-5 flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: '#EBF4F6', border: '1px solid #D4E6EA' }}
        >
          <Calendar className="h-4 w-4 text-roameoAccent flex-shrink-0" />
          <span className="text-sm font-semibold text-roameoDark">{checkIn}</span>
          <span className="text-slate-300 text-base">→</span>
          <span className="text-sm font-semibold text-roameoDark">{checkOut}</span>
          <span className="text-slate-300 mx-1">·</span>
          <span className="text-sm text-slate-500">
            {nights} night{nights !== 1 ? 's' : ''}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Guest fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Guest Name *
              </label>
              <input
                type="text"
                required
                placeholder="Full name"
                value={form.guestName}
                onChange={set('guestName')}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary focus:ring-2 focus:ring-roameoPrimary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Phone *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="03xx-xxxxxxx"
                  value={form.phone}
                  onChange={set('phone')}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary focus:ring-2 focus:ring-roameoPrimary/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  CNIC
                </label>
                <input
                  type="text"
                  placeholder="12345-1234567-1"
                  value={form.cnic}
                  onChange={set('cnic')}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary focus:ring-2 focus:ring-roameoPrimary/20"
                />
              </div>
            </div>
          </div>

          {/* Price breakdown */}
          <div className="rounded-xl overflow-hidden text-sm" style={{ border: '1px solid #E2E8F0' }}>
            <div
              className="flex justify-between px-4 py-2.5 bg-white"
              style={{ borderBottom: '1px solid #F1F5F9' }}
            >
              <span className="text-slate-500">Rate</span>
              <span className="font-medium text-slate-700">{formatCurrency(room.price)} / night</span>
            </div>
            <div
              className="flex justify-between px-4 py-2.5 bg-white"
              style={{ borderBottom: '1px solid #F1F5F9' }}
            >
              <span className="text-slate-500">Duration</span>
              <span className="font-medium text-slate-700">
                {nights} night{nights !== 1 ? 's' : ''}
              </span>
            </div>
            <div
              className="flex justify-between px-4 py-2.5 bg-slate-50 font-semibold"
              style={{ borderBottom: '1px solid #F1F5F9' }}
            >
              <span className="text-slate-700">Total</span>
              <span className="text-slate-800">{formatCurrency(totalPrice)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5" style={{ background: '#EBF4F6' }}>
              <span className="font-semibold text-roameoAccent text-sm">Advance (20%)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.advance}
                onChange={set('advance')}
                className="w-28 px-3 py-1.5 text-sm text-right font-bold text-roameoDark bg-white border border-roameoBorder rounded-lg outline-none focus:border-roameoPrimary transition-colors"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)',
                boxShadow: '0 4px 14px rgba(79,111,118,0.30)',
              }}
            >
              {submitting ? 'Confirming…' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── RoomAvailabilityGrid ──────────────────────────────────────────────────────

export const RoomAvailabilityGrid: React.FC = () => {
  const today = useMemo(() => todayISO(), []);
  const [windowStart, setWindowStart] = useState(today);
  const dates = useMemo(() => makeDateRange(windowStart, DAYS), [windowStart]);

  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [bookings, setBookings] = useState<GridBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const [drag, setDrag] = useState<DragState>({
    active: false,
    roomId: null,
    startDate: null,
    endDate: null,
  });
  const [modalData, setModalData] = useState<ModalData | null>(null);

  // ── Data fetch ───────────────────────────────────────────────────────────────
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: rData }, { data: bData }] = await Promise.all([
        supabase
          .from('rooms')
          .select('id, room_number, room_type, price, status')
          .order('room_number'),
        supabase
          .from('bookings')
          .select('id, room_id, guest_name, check_in, check_out, status')
          .neq('status', 'Cancelled'),
      ]);
      setRooms(rData ?? []);
      setBookings(bData ?? []);
    } catch (e) {
      console.error('RoomAvailabilityGrid fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Index bookings by room for O(1) lookup ────────────────────────────────────
  const bookingsByRoom = useMemo(() => {
    const map: Record<string, GridBooking[]> = {};
    bookings.forEach(b => { (map[b.room_id] ??= []).push(b); });
    return map;
  }, [bookings]);

  // ── Precompute base cell statuses for the visible window (no drag influence) ──
  const baseGrid = useMemo<Record<string, Record<string, BaseStatus>>>(() => {
    const grid: Record<string, Record<string, BaseStatus>> = {};

    rooms.forEach(room => {
      grid[room.id] = {};
      const rbs = bookingsByRoom[room.id] ?? [];

      dates.forEach(date => {
        // Maintenance rooms are fully blocked
        if (room.status === 'Maintenance') {
          grid[room.id][date] = 'maintenance';
          return;
        }
        // Past dates are grayed out and unselectable
        if (date < today) {
          grid[room.id][date] = 'past';
          return;
        }

        let status: BaseStatus = date === today ? 'today' : 'available';
        let isCheckout = false;

        for (const b of rbs) {
          if (date === b.check_in) {
            // Check-in day: room occupied, highlight amber
            status = 'checkin';
            isCheckout = false;
            break;
          }
          if (date > b.check_in && date < b.check_out) {
            // Middle of booking: fully reserved
            status = 'reserved';
            isCheckout = false;
            break;
          }
          if (date === b.check_out) {
            // Check-out day: available for new check-in, show amber OUT label
            isCheckout = true;
          }
        }

        if (status !== 'checkin' && status !== 'reserved' && isCheckout) {
          status = 'checkout';
        }

        grid[room.id][date] = status;
      });
    });

    return grid;
  }, [rooms, dates, bookingsByRoom, today]);

  // ── Final cell status with drag overlay ──────────────────────────────────────
  const getCellStatus = useCallback(
    (roomId: string, date: string): CellStatus => {
      const base: BaseStatus = baseGrid[roomId]?.[date] ?? 'available';

      if (drag.active && drag.roomId === roomId && drag.startDate && drag.endDate) {
        const [s, e] = [drag.startDate, drag.endDate].sort();
        if (
          date >= s &&
          date <= e &&
          (base === 'available' || base === 'today' || base === 'checkout')
        ) {
          return 'selecting';
        }
      }

      return base;
    },
    [baseGrid, drag],
  );

  // A date is valid as a drag start or extension point
  const isAvailable = useCallback(
    (roomId: string, date: string): boolean => {
      const s = baseGrid[roomId]?.[date];
      return s === 'available' || s === 'today' || s === 'checkout';
    },
    [baseGrid],
  );

  // ── Drag interaction ─────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (roomId: string, date: string) => {
      if (!isAvailable(roomId, date)) return;
      setDrag({ active: true, roomId, startDate: date, endDate: date });
    },
    [isAvailable],
  );

  const handleMouseEnter = useCallback(
    (roomId: string, date: string) => {
      if (!drag.active || drag.roomId !== roomId) return;

      // Walk every date in the candidate range; bail if any is blocked
      const [s, e] = [drag.startDate!, date].sort();
      let cursor = s;
      while (cursor <= e) {
        if (!isAvailable(roomId, cursor)) return; // blocked — don't extend
        cursor = addDays(cursor, 1);
      }

      setDrag(prev => ({ ...prev, endDate: date }));
    },
    [drag, isAvailable],
  );

  // Global mouse-up: finalize drag, open modal if valid range (>= 1 night)
  useEffect(() => {
    const onMouseUp = () => {
      if (drag.active && drag.roomId && drag.startDate && drag.endDate) {
        const [checkIn, checkOut] = [drag.startDate, drag.endDate].sort();
        if (checkIn !== checkOut) {
          const room = rooms.find(r => r.id === drag.roomId);
          if (room) setModalData({ room, checkIn, checkOut });
        }
      }
      setDrag({ active: false, roomId: null, startDate: null, endDate: null });
    };

    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [drag, rooms]);

  // Suppress browser text-selection during drag
  useEffect(() => {
    document.body.style.userSelect = drag.active ? 'none' : '';
    return () => { document.body.style.userSelect = ''; };
  }, [drag.active]);

  // ── Period navigation ─────────────────────────────────────────────────────────
  const prev = () => setWindowStart(d => addDays(d, -DAYS));
  const next = () => setWindowStart(d => addDays(d, DAYS));
  const jumpToToday = () => setWindowStart(today);

  // ── Loading ───────────────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">{periodLabel(dates)}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Click and drag across available cells to create a booking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={jumpToToday}
            className="px-3 py-1.5 text-xs font-semibold text-roameoAccent border border-roameoBorder rounded-lg hover:bg-roameoLight transition-colors"
          >
            Today
          </button>
          <button
            onClick={prev}
            className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={next}
            className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 flex-wrap">
        {(
          [
            ['bg-emerald-50 border-emerald-200', 'Available'],
            ['bg-blue-200 border-blue-300', 'Selecting'],
            ['bg-amber-100 border-amber-200', 'Check-in / out'],
            ['bg-red-100 border-red-200', 'Reserved'],
            ['bg-slate-100 border-slate-200', 'Unavailable'],
          ] as [string, string][]
        ).map(([cls, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`h-3 w-3 rounded-sm border ${cls}`} />
            <span className="text-[11px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Grid container */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)',
          border: '1px solid rgba(212,230,234,0.7)',
        }}
      >
        <div className="overflow-auto" style={{ maxHeight: '62vh' }}>
          <div
            style={{
              minWidth: ROOM_W + CELL_W * DAYS,
              cursor: drag.active ? 'crosshair' : 'default',
            }}
          >
            {/* ── Header row ── */}
            <div
              className="flex sticky top-0 z-20 bg-white"
              style={{ borderBottom: '2px solid #E2EEF0' }}
            >
              {/* Corner */}
              <div
                className="flex-shrink-0 sticky left-0 z-30 bg-white flex items-end px-4 py-3"
                style={{ width: ROOM_W, borderRight: '2px solid #E2EEF0' }}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Room
                </span>
              </div>

              {/* Date headers */}
              {dates.map(date => {
                const { dayNum, dayName, monthShort, isWeekend, isFirst } = headerFor(date);
                const isToday = date === today;
                const showMonth = isFirst || date === dates[0];

                return (
                  <div
                    key={date}
                    className="flex-shrink-0 flex flex-col items-center justify-end py-2 border-r border-slate-100"
                    style={{ width: CELL_W }}
                  >
                    {showMonth && (
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wide leading-none mb-0.5">
                        {monthShort}
                      </span>
                    )}
                    <span
                      className={`text-[10px] leading-none ${
                        isWeekend ? 'text-roameoMuted' : 'text-slate-400'
                      }`}
                    >
                      {dayName}
                    </span>
                    <span
                      className={[
                        'text-xs font-bold mt-0.5 h-6 w-6 flex items-center justify-center rounded-full',
                        isToday
                          ? 'bg-roameoPrimary text-white'
                          : isWeekend
                          ? 'text-roameoAccent'
                          : 'text-slate-600',
                      ].join(' ')}
                    >
                      {dayNum}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Room rows ── */}
            {rooms.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-slate-400 bg-white">
                No rooms found. Add rooms in the Rooms section first.
              </div>
            ) : (
              rooms.map(room => (
                <div
                  key={room.id}
                  className="flex group"
                  style={{ borderBottom: '1px solid #F1F5F9' }}
                >
                  {/* Room label — sticky */}
                  <div
                    className="flex-shrink-0 sticky left-0 z-10 bg-white group-hover:bg-slate-50/70 flex flex-col justify-center px-4 py-3 transition-colors"
                    style={{
                      width: ROOM_W,
                      minHeight: CELL_W,
                      borderRight: '2px solid #E2EEF0',
                    }}
                  >
                    <span className="text-sm font-semibold text-slate-800 leading-tight">
                      {room.room_number}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      {room.room_type} · {formatCurrency(room.price)}/n
                    </span>
                  </div>

                  {/* Date cells */}
                  {dates.map(date => {
                    const status = getCellStatus(room.id, date);
                    return (
                      <div
                        key={date}
                        className={CELL_CLASSES[status]}
                        style={{ width: CELL_W, height: CELL_W }}
                        onMouseDown={() => handleMouseDown(room.id, date)}
                        onMouseEnter={() => handleMouseEnter(room.id, date)}
                      >
                        {CELL_LABELS[status] ?? ''}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Booking modal */}
      {modalData && (
        <BookingModal
          data={modalData}
          onClose={() => setModalData(null)}
          onSuccess={newBooking => {
            setBookings(prev => [...prev, newBooking]);
            setModalData(null);
          }}
        />
      )}
    </div>
  );
};
