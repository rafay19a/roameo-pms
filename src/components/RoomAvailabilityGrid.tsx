import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, generateBookingToken } from '../lib/utils';
import { X, ChevronLeft, ChevronRight, Calendar, AlertCircle, Phone, User, Clock, Wrench, Tag, Gift } from 'lucide-react';
import { BookingConfirmationCard, ReceiptBooking } from './BookingConfirmationCard';

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
  guest_phone?: string;
  check_in: string;
  check_out: string;
  status: string;
}

interface MaintenanceRecord {
  id: string;
  room_id: string;
  start_date: string;
  end_date: string;
  note?: string;
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

interface TooltipState {
  booking: GridBooking;
  anchorRect: DOMRect;
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
const CELL_W = 52;
const ROOM_W = 176;

// ─── Cell visual config ───────────────────────────────────────────────────────

const CELL_BASE =
  'flex-shrink-0 flex items-center justify-center text-[10px] font-bold select-none border-r border-b border-slate-100 transition-colors duration-75';

const CELL_CLASSES: Record<CellStatus, string> = {
  available:   `${CELL_BASE} bg-emerald-50   hover:bg-emerald-100  cursor-crosshair  text-emerald-600`,
  today:       `${CELL_BASE} bg-emerald-100  hover:bg-emerald-200  cursor-crosshair  text-emerald-700  ring-1 ring-inset ring-emerald-300`,
  checkin:     `${CELL_BASE} bg-amber-100    cursor-pointer        text-amber-700`,
  reserved:    `${CELL_BASE} bg-red-100      cursor-pointer        text-red-500`,
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

// ─── BookingTooltip ───────────────────────────────────────────────────────────

const BookingTooltip: React.FC<{ state: TooltipState }> = ({ state }) => {
  const { booking, anchorRect } = state;

  const isNearTop = anchorRect.top < 180;
  const rawLeft = anchorRect.left - 4;
  const left = Math.max(8, Math.min(rawLeft, window.innerWidth - 232));

  return (
    <div
      className="fixed z-50 w-56 pointer-events-none"
      style={{
        left,
        top: isNearTop ? anchorRect.bottom + 8 : anchorRect.top - 8,
        transform: isNearTop ? 'none' : 'translateY(-100%)',
      }}
    >
      <div
        className="bg-white rounded-xl p-3.5 animate-fade-in"
        style={{
          boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 1px 4px rgba(0,0,0,0.08)',
          border: '1px solid rgba(212,230,234,0.8)',
        }}
      >
        {/* Guest info */}
        <div className="flex items-start gap-2.5 mb-2.5">
          <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <User className="h-3.5 w-3.5 text-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 leading-tight truncate">
              {booking.guest_name}
            </p>
            {booking.guest_phone && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" />
                {booking.guest_phone}
              </p>
            )}
          </div>
        </div>

        {/* Dates + status */}
        <div className="space-y-1.5 pt-2.5" style={{ borderTop: '1px solid #F1F5F9' }}>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span>{booking.check_in}</span>
            <span className="text-slate-300">→</span>
            <span>{booking.check_out}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Status</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                booking.status === 'Checked-in'
                  ? 'bg-amber-50 text-amber-700'
                  : booking.status === 'Confirmed'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {booking.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MaintenanceModal ─────────────────────────────────────────────────────────

const FIELD = 'w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary focus:ring-2 focus:ring-roameoPrimary/20';

interface MaintenanceModalProps {
  room: RoomRow;
  onClose: () => void;
  onSaved: () => void;
}

const MaintenanceModal: React.FC<MaintenanceModalProps> = ({ room, onClose, onSaved }) => {
  const today = todayISO();
  const [form, setForm] = useState({ start_date: today, end_date: today, note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.end_date < form.start_date) { setError('End date must be on or after start date'); return; }
    setSaving(true);
    try {
      const { error: err } = await supabase.from('room_maintenance').insert([{
        room_id: room.id,
        start_date: form.start_date,
        end_date: form.end_date,
        note: form.note.trim() || null,
      }]);
      if (err) throw err;
      onSaved();
    } catch (ex: any) {
      setError(ex.message ?? 'Failed to save maintenance record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" style={{ border: '1px solid rgba(212,230,234,0.9)' }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <h3 className="text-[17px] font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Wrench className="h-4 w-4 text-slate-500" /> Schedule Maintenance
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Room {room.room_number} · {room.room_type}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Start Date *</label>
              <input type="date" required className={FIELD} value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">End Date *</label>
              <input type="date" required className={FIELD} value={form.end_date} min={form.start_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Note (optional)</label>
            <input type="text" className={FIELD} placeholder="e.g. Plumbing repair" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)', boxShadow: '0 4px 14px rgba(79,111,118,0.30)' }}>
              {saving ? 'Saving…' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── BookingModal ─────────────────────────────────────────────────────────────

interface BookingModalProps {
  data: ModalData;
  onClose: () => void;
  onSuccess: (b: GridBooking, receipt: ReceiptBooking) => void;
}

const DISC_PCTS = [0, 10, 15, 20, 30];

const BookingModal: React.FC<BookingModalProps> = ({ data, onClose, onSuccess }) => {
  const { room, checkIn, checkOut } = data;
  const nights = diffDays(checkIn, checkOut);
  const basePrice = nights * room.price;

  const [form, setForm] = useState({
    guestName: '',
    phone: '',
    cnic: '',
    discountPct: 0,
    fixedDiscount: 0,
    freeStay: false,
    advance: +(basePrice * 0.2).toFixed(0),
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const finalTotal = useMemo(() => {
    if (form.freeStay) return 0;
    return Math.max(0, basePrice * (1 - form.discountPct / 100) - form.fixedDiscount);
  }, [basePrice, form.discountPct, form.fixedDiscount, form.freeStay]);

  // Auto-update advance when finalTotal changes (keeps 20% default)
  useEffect(() => {
    setForm(f => ({ ...f, advance: +(finalTotal * 0.2).toFixed(0) }));
  }, [finalTotal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.guestName.trim()) return setError('Guest name is required');
    if (!form.phone.trim()) return setError('Phone number is required');
    setSubmitting(true);

    const token = generateBookingToken();

    const base: Record<string, unknown> = {
      booking_token: token,
      guest_name: form.guestName.trim(),
      room_id: room.id,
      check_in: checkIn,
      check_out: checkOut,
      total_price: finalTotal,
      status: 'Pending',
    };

    const doInsert = async (payload: Record<string, unknown>) => {
      const { data: row, error: err } = await supabase
        .from('bookings')
        .insert([payload])
        .select('id, booking_token')
        .single();
      return { row, err };
    };

    try {
      let { row, err } = await doInsert({
        ...base,
        guest_phone: form.phone.trim(),
        guest_cnic: form.cnic.trim(),
        advance_amount: form.advance,
      });

      if (err && err.message?.includes('column')) {
        ({ row, err } = await doInsert(base));
      }

      if (err) throw err;

      const gridBooking: GridBooking = {
        id: row!.id,
        room_id: room.id,
        guest_name: form.guestName,
        guest_phone: form.phone.trim(),
        check_in: checkIn,
        check_out: checkOut,
        status: 'Pending',
      };

      const receipt: ReceiptBooking = {
        id: row!.id,
        booking_token: row!.booking_token ?? token,
        guest_name: form.guestName.trim(),
        guest_phone: form.phone.trim(),
        room_id: room.id,
        room_number: room.room_number,
        room_type: room.room_type,
        price_per_night: room.price,
        check_in: checkIn,
        check_out: checkOut,
        total_price: finalTotal,
        advance_amount: form.advance,
        status: 'Pending',
        payment_proof_url: null,
        confirmed_token: null,
      };

      onSuccess(gridBooking, receipt);
    } catch (ex: any) {
      setError(ex.message ?? 'Failed to save booking');
    } finally {
      setSubmitting(false);
    }
  };

  const discountAmount = basePrice - finalTotal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto"
        style={{ border: '1px solid rgba(212,230,234,0.9)', maxHeight: '92vh' }}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <h3 className="text-[17px] font-bold text-slate-800 tracking-tight">New Booking</h3>
            <p className="text-xs text-slate-400 mt-0.5">Room {room.room_number} · {room.room_type}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-6 my-5 flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: '#EBF4F6', border: '1px solid #D4E6EA' }}>
          <Calendar className="h-4 w-4 text-roameoAccent flex-shrink-0" />
          <span className="text-sm font-semibold text-roameoDark">{checkIn}</span>
          <span className="text-slate-300 text-base">→</span>
          <span className="text-sm font-semibold text-roameoDark">{checkOut}</span>
          <span className="text-slate-300 mx-1">·</span>
          <span className="text-sm text-slate-500">{nights} night{nights !== 1 ? 's' : ''}</span>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Guest fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Guest Name *</label>
              <input type="text" required placeholder="Full name" value={form.guestName} onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))} className={FIELD} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Phone *</label>
                <input type="tel" required placeholder="03xx-xxxxxxx" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={FIELD} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">CNIC</label>
                <input type="text" placeholder="12345-1234567-1" value={form.cnic} onChange={e => setForm(f => ({ ...f, cnic: e.target.value }))} className={FIELD} />
              </div>
            </div>
          </div>

          {/* Discount section */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="h-3 w-3" /> Discount
              </p>
              {/* Free Stay toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Gift className="h-3.5 w-3.5" /> Free Stay</span>
                <div
                  className={`relative h-5 w-9 rounded-full transition-colors ${form.freeStay ? 'bg-roameoAccent' : 'bg-slate-200'}`}
                  onClick={() => setForm(f => ({ ...f, freeStay: !f.freeStay, discountPct: 0, fixedDiscount: 0 }))}
                >
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.freeStay ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>

            {!form.freeStay && (
              <>
                {/* % pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {DISC_PCTS.map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, discountPct: pct }))}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        form.discountPct === pct
                          ? 'text-white'
                          : 'bg-white border border-roameoBorder text-slate-500 hover:border-roameoAccent hover:text-roameoAccent'
                      }`}
                      style={form.discountPct === pct ? { background: 'linear-gradient(135deg,#6F8F97,#4F6F76)' } : {}}
                    >
                      {pct === 0 ? 'None' : `${pct}%`}
                    </button>
                  ))}
                </div>
                {/* Fixed discount */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 flex-shrink-0">Fixed off (Rs)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.fixedDiscount}
                    onChange={e => setForm(f => ({ ...f, fixedDiscount: Math.max(0, Number(e.target.value)) }))}
                    className="flex-1 px-3 py-1.5 text-sm text-right font-medium text-slate-700 bg-white border border-roameoBorder rounded-lg outline-none focus:border-roameoPrimary transition-colors"
                  />
                </div>
              </>
            )}
          </div>

          {/* Pricing summary */}
          <div className="rounded-xl overflow-hidden text-sm" style={{ border: '1px solid #E2E8F0' }}>
            <div className="flex justify-between px-4 py-2.5 bg-white" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <span className="text-slate-500">Rate</span>
              <span className="font-medium text-slate-700">{formatCurrency(room.price)} / night</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 bg-white" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <span className="text-slate-500">Subtotal ({nights}n)</span>
              <span className="font-medium text-slate-700">{formatCurrency(basePrice)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between px-4 py-2.5 bg-white" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <span className="text-emerald-600">Discount</span>
                <span className="font-medium text-emerald-600">− {formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between px-4 py-2.5 bg-slate-50 font-semibold" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <span className="text-slate-700">Total</span>
              <span className={form.freeStay ? 'text-emerald-600' : 'text-slate-800'}>
                {form.freeStay ? 'FREE' : formatCurrency(finalTotal)}
              </span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5" style={{ background: '#EBF4F6' }}>
              <span className="font-semibold text-roameoAccent text-sm">Advance (20%)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.advance}
                onChange={e => setForm(f => ({ ...f, advance: +e.target.value }))}
                className="w-28 px-3 py-1.5 text-sm text-right font-bold text-roameoDark bg-white border border-roameoBorder rounded-lg outline-none focus:border-roameoPrimary transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)', boxShadow: '0 4px 14px rgba(79,111,118,0.30)' }}>
              {submitting ? 'Confirming…' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── RoomAvailabilityGrid ─────────────────────────────────────────────────────

export const RoomAvailabilityGrid: React.FC = () => {
  const today = useMemo(() => todayISO(), []);
  const [windowStart, setWindowStart] = useState(today);
  const dates = useMemo(() => makeDateRange(windowStart, DAYS), [windowStart]);

  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [bookings, setBookings] = useState<GridBooking[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [maintenanceRoom, setMaintenanceRoom] = useState<RoomRow | null>(null);

  // ── Drag state: both React state (for render) and a ref (for stale-closure-free touch handlers)
  const [drag, setDrag] = useState<DragState>({ active: false, roomId: null, startDate: null, endDate: null });
  const dragRef = useRef<DragState>({ active: false, roomId: null, startDate: null, endDate: null });

  const updateDrag = useCallback((next: DragState) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [receiptBooking, setReceiptBooking] = useState<ReceiptBooking | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Refs for touch gesture tracking
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // ── Data fetch ────────────────────────────────────────────────────────────────
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: rData }, { data: bData }, { data: mData }] = await Promise.all([
        supabase.from('rooms').select('id, room_number, room_type, price, status').order('room_number'),
        supabase.from('bookings').select('id, room_id, guest_name, guest_phone, check_in, check_out, status').neq('status', 'Cancelled'),
        supabase.from('room_maintenance').select('id, room_id, start_date, end_date, note').gte('end_date', today),
      ]);
      setRooms(rData ?? []);
      setBookings(bData ?? []);
      setMaintenance(mData ?? []);
    } catch (e) {
      console.error('RoomAvailabilityGrid fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Index bookings by room ────────────────────────────────────────────────────
  const bookingsByRoom = useMemo(() => {
    const map: Record<string, GridBooking[]> = {};
    bookings.forEach(b => { (map[b.room_id] ??= []).push(b); });
    return map;
  }, [bookings]);

  // ── Index maintenance records by room ─────────────────────────────────────────
  const maintenanceByRoom = useMemo(() => {
    const map: Record<string, MaintenanceRecord[]> = {};
    maintenance.forEach(m => { (map[m.room_id] ??= []).push(m); });
    return map;
  }, [maintenance]);

  // ── Precompute base grid (no drag influence) ──────────────────────────────────
  const baseGrid = useMemo<Record<string, Record<string, BaseStatus>>>(() => {
    const grid: Record<string, Record<string, BaseStatus>> = {};
    rooms.forEach(room => {
      grid[room.id] = {};
      const rbs = bookingsByRoom[room.id] ?? [];
      const rms = maintenanceByRoom[room.id] ?? [];
      dates.forEach(date => {
        if (room.status === 'Maintenance') { grid[room.id][date] = 'maintenance'; return; }
        if (rms.some(m => date >= m.start_date && date <= m.end_date)) { grid[room.id][date] = 'maintenance'; return; }
        if (date < today)                  { grid[room.id][date] = 'past'; return; }

        let status: BaseStatus = date === today ? 'today' : 'available';
        let isCheckout = false;

        for (const b of rbs) {
          if (date === b.check_in)                         { status = 'checkin'; isCheckout = false; break; }
          if (date > b.check_in && date < b.check_out)     { status = 'reserved'; isCheckout = false; break; }
          if (date === b.check_out)                        { isCheckout = true; }
        }

        if (status !== 'checkin' && status !== 'reserved' && isCheckout) status = 'checkout';
        grid[room.id][date] = status;
      });
    });
    return grid;
  }, [rooms, dates, bookingsByRoom, maintenanceByRoom, today]);

  // ── Cell status with drag overlay ─────────────────────────────────────────────
  const getCellStatus = useCallback(
    (roomId: string, date: string): CellStatus => {
      const base: BaseStatus = baseGrid[roomId]?.[date] ?? 'available';
      if (drag.active && drag.roomId === roomId && drag.startDate && drag.endDate) {
        const [s, e] = [drag.startDate, drag.endDate].sort();
        if (date >= s && date <= e && (base === 'available' || base === 'today' || base === 'checkout')) {
          return 'selecting';
        }
      }
      return base;
    },
    [baseGrid, drag],
  );

  const isAvailable = useCallback(
    (roomId: string, date: string): boolean => {
      const s = baseGrid[roomId]?.[date];
      return s === 'available' || s === 'today' || s === 'checkout';
    },
    [baseGrid],
  );

  // Helper: find the booking that covers a given cell
  const bookingForCell = useCallback(
    (roomId: string, date: string): GridBooking | null => {
      const rbs = bookingsByRoom[roomId] ?? [];
      return rbs.find(b => date >= b.check_in && date < b.check_out) ?? null;
    },
    [bookingsByRoom],
  );

  // ── Mouse drag (desktop) ──────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (roomId: string, date: string) => {
      if (!isAvailable(roomId, date)) return;
      setTooltip(null);
      updateDrag({ active: true, roomId, startDate: date, endDate: date });
    },
    [isAvailable, updateDrag],
  );

  const handleMouseEnter = useCallback(
    (roomId: string, date: string) => {
      if (!dragRef.current.active || dragRef.current.roomId !== roomId) return;
      const [s, e] = [dragRef.current.startDate!, date].sort();
      let cursor = s;
      while (cursor <= e) {
        if (!isAvailable(roomId, cursor)) return;
        cursor = addDays(cursor, 1);
      }
      updateDrag({ ...dragRef.current, endDate: date });
    },
    [isAvailable, updateDrag],
  );

  // Global mouseup — finalize desktop drag
  useEffect(() => {
    const onMouseUp = () => {
      const { active, roomId, startDate, endDate } = dragRef.current;
      if (active && roomId && startDate && endDate) {
        const [checkIn, checkOut] = [startDate, endDate].sort();
        if (checkIn !== checkOut) {
          const room = rooms.find(r => r.id === roomId);
          if (room) setModalData({ room, checkIn, checkOut });
        }
      }
      const cleared: DragState = { active: false, roomId: null, startDate: null, endDate: null };
      dragRef.current = cleared;
      setDrag(cleared);
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [rooms]);

  // Suppress text-selection during mouse drag
  useEffect(() => {
    document.body.style.userSelect = drag.active ? 'none' : '';
    return () => { document.body.style.userSelect = ''; };
  }, [drag.active]);

  // ── Touch drag (mobile) ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = gridScrollRef.current;
    if (!el) return;

    // Record touch start position for tap-vs-scroll detection
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      touchStartPosRef.current = { x: t.clientX, y: t.clientY };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current.active) return; // not dragging — allow scroll
      e.preventDefault(); // prevent scroll while drag-selecting

      if (e.touches.length !== 1) return;
      const touch = e.touches[0];

      // Hit-test the element currently under the finger
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const cell = target?.closest('[data-room-id][data-date]') as HTMLElement | null;
      if (!cell) return;

      const rid = cell.dataset.roomId!;
      const d   = cell.dataset.date!;
      if (rid !== dragRef.current.roomId) return;

      // Walk range — bail if any date is blocked
      const [lo, hi] = [dragRef.current.startDate!, d].sort();
      let cursor = lo;
      while (cursor <= hi) {
        const st = baseGrid[rid]?.[cursor];
        if (st !== 'available' && st !== 'today' && st !== 'checkout') return;
        cursor = addDays(cursor, 1);
      }

      const next: DragState = { ...dragRef.current, endDate: d };
      dragRef.current = next;
      setDrag(next);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const startPos = touchStartPosRef.current;
      const delta = startPos
        ? Math.hypot(touch.clientX - startPos.x, touch.clientY - startPos.y)
        : Infinity;

      const { active, roomId, startDate, endDate } = dragRef.current;

      if (active && roomId && startDate && endDate) {
        const [checkIn, checkOut] = [startDate, endDate].sort();
        if (checkIn !== checkOut) {
          // Range drag — open booking modal
          const room = rooms.find(r => r.id === roomId);
          if (room) setModalData({ room, checkIn, checkOut });
        }
        // Single-cell tap on available: no action
      } else if (delta < 10) {
        // Short tap on a non-drag cell — check for tooltip
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const cell = target?.closest('[data-room-id][data-date]') as HTMLElement | null;
        if (cell) {
          const rid = cell.dataset.roomId;
          const d   = cell.dataset.date;
          if (rid && d) {
            const rbs = bookingsByRoom[rid] ?? [];
            const b   = rbs.find(bk => d >= bk.check_in && d < bk.check_out);
            if (b) {
              const rect = cell.getBoundingClientRect();
              // Toggle: tap same cell again to close
              setTooltip(prev => prev?.booking.id === b.id ? null : { booking: b, anchorRect: rect });
              touchStartPosRef.current = null;
              return;
            }
          }
        }
        // Tap on non-booked area — dismiss tooltip
        setTooltip(null);
      }

      const cleared: DragState = { active: false, roomId: null, startDate: null, endDate: null };
      dragRef.current = cleared;
      setDrag(cleared);
      touchStartPosRef.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [baseGrid, rooms, bookingsByRoom]);

  // ── Period navigation ─────────────────────────────────────────────────────────
  const prev = () => setWindowStart(d => addDays(d, -DAYS));
  const next = () => setWindowStart(d => addDays(d, DAYS));
  const jumpToToday = () => setWindowStart(today);

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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">{periodLabel(dates)}</p>
          <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
            Drag across available cells to book · Tap a red cell to see guest info
          </p>
          <p className="text-xs text-slate-400 mt-0.5 sm:hidden">
            Touch &amp; drag to book · Tap red cell for guest info
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
      <div className="flex items-center gap-4 flex-wrap">
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
        <div
          ref={gridScrollRef}
          className="overflow-auto"
          style={{ maxHeight: '62vh', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
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
              <div
                className="flex-shrink-0 sticky left-0 z-30 bg-white flex items-end px-4 py-3"
                style={{ width: ROOM_W, borderRight: '2px solid #E2EEF0' }}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Room
                </span>
              </div>

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
                    <span className={`text-[10px] leading-none ${isWeekend ? 'text-roameoMuted' : 'text-slate-400'}`}>
                      {dayName}
                    </span>
                    <span
                      className={[
                        'text-xs font-bold mt-0.5 h-6 w-6 flex items-center justify-center rounded-full',
                        isToday ? 'bg-roameoPrimary text-white' : isWeekend ? 'text-roameoAccent' : 'text-slate-600',
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
                    className="flex-shrink-0 sticky left-0 z-10 bg-white group-hover:bg-slate-50/70 flex items-center justify-between px-4 py-3 transition-colors"
                    style={{ width: ROOM_W, minHeight: CELL_W, borderRight: '2px solid #E2EEF0' }}
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-slate-800 leading-tight block">
                        {room.room_number}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5 block">
                        {room.room_type} · {formatCurrency(room.price)}/n
                      </span>
                    </div>
                    <button
                      onClick={() => setMaintenanceRoom(room)}
                      title="Schedule maintenance"
                      className="flex-shrink-0 h-6 w-6 rounded-md flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Date cells */}
                  {dates.map(date => {
                    const status = getCellStatus(room.id, date);
                    const isBooked = status === 'reserved' || status === 'checkin';

                    return (
                      <div
                        key={date}
                        className={CELL_CLASSES[status]}
                        style={{ width: CELL_W, height: CELL_W }}
                        // Data attributes for touch hit-testing
                        data-room-id={room.id}
                        data-date={date}
                        // ── Mouse events (desktop) ──
                        onMouseDown={() => handleMouseDown(room.id, date)}
                        onMouseEnter={e => {
                          handleMouseEnter(room.id, date);
                          // Show tooltip on hover for booked cells
                          if (isBooked && !dragRef.current.active) {
                            const b = bookingForCell(room.id, date);
                            if (b) {
                              setTooltip({
                                booking: b,
                                anchorRect: (e.currentTarget as HTMLElement).getBoundingClientRect(),
                              });
                            }
                          }
                        }}
                        onMouseLeave={() => {
                          if (!dragRef.current.active) setTooltip(null);
                        }}
                        // ── Touch start (mobile) — starts drag on available cells ──
                        onTouchStart={() => {
                          if (isAvailable(room.id, date)) {
                            updateDrag({ active: true, roomId: room.id, startDate: date, endDate: date });
                          }
                        }}
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

      {/* Booking tooltip */}
      {tooltip && <BookingTooltip state={tooltip} />}

      {/* Booking modal */}
      {modalData && (
        <BookingModal
          data={modalData}
          onClose={() => setModalData(null)}
          onSuccess={(newBooking, receipt) => {
            setBookings(prev => [...prev, newBooking]);
            setModalData(null);
            setReceiptBooking(receipt);
          }}
        />
      )}

      {receiptBooking && (
        <BookingConfirmationCard
          booking={receiptBooking}
          onClose={() => setReceiptBooking(null)}
          onStatusChange={(id, status, confirmed_token) => {
            setBookings(prev =>
              prev.map(b => b.id === id ? { ...b, status } : b)
            );
            setReceiptBooking(prev =>
              prev ? { ...prev, status, confirmed_token: confirmed_token ?? prev.confirmed_token } : prev
            );
          }}
        />
      )}

      {maintenanceRoom && (
        <MaintenanceModal
          room={maintenanceRoom}
          onClose={() => setMaintenanceRoom(null)}
          onSaved={() => { setMaintenanceRoom(null); fetchData(); }}
        />
      )}
    </div>
  );
};
