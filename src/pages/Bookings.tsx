import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, generateBookingToken } from '../lib/utils';
import { Plus, Edit, Trash2, CalendarDays, List, FileText, UtensilsCrossed, X, Minus, Eye } from 'lucide-react';
import { RoomAvailabilityGrid } from '../components/RoomAvailabilityGrid';
import { BookingConfirmationCard, ReceiptBooking } from '../components/BookingConfirmationCard';
import { FeedbackModal } from '../components/FeedbackModal';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';

interface Booking {
  id: string;
  booking_token: string;
  confirmed_token?: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone?: string | null;
  room_id: string;
  check_in: string;
  check_out: string;
  total_price: number;
  advance_amount?: number | null;
  status: string;
  payment_proof_url?: string | null;
  rooms: { room_number: string; room_type: string; price: number };
}

function toReceiptBooking(b: Booking): ReceiptBooking {
  return {
    id: b.id,
    booking_token: b.booking_token,
    confirmed_token: b.confirmed_token,
    guest_name: b.guest_name,
    guest_phone: b.guest_phone,
    room_id: b.room_id,
    room_number: b.rooms?.room_number ?? '—',
    room_type: b.rooms?.room_type ?? '—',
    price_per_night: b.rooms?.price ?? 0,
    check_in: b.check_in,
    check_out: b.check_out,
    total_price: b.total_price,
    advance_amount: b.advance_amount,
    status: b.status,
    payment_proof_url: b.payment_proof_url,
  };
}

interface Room {
  id: string;
  room_number: string;
  price: number;
}

const ALL_STATUSES = ['Pending', 'Confirmed', 'Checked-in', 'Completed', 'Cancelled'];

const STATUS_STYLES: Record<string, string> = {
  'Pending':    'bg-slate-100 text-slate-600',
  'Confirmed':  'bg-emerald-50 text-emerald-700',
  'Checked-in': 'bg-amber-50 text-amber-700',
  'Completed':  'bg-teal-50 text-teal-700',
  'Cancelled':  'bg-red-50 text-red-600',
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  'Pending':    ['Confirmed', 'Cancelled'],
  'Confirmed':  ['Checked-in', 'Cancelled'],
  'Checked-in': ['Completed'],
  'Completed':  [],
  'Cancelled':  [],
};

const BookingModal = ({
  booking,
  rooms,
  onClose,
  onSave,
}: {
  booking: Booking | null;
  rooms: Room[];
  onClose: () => void;
  onSave: () => void;
}) => {
  const [formData, setFormData] = useState({
    guest_name: booking?.guest_name || '',
    guest_email: booking?.guest_email || '',
    room_id: booking?.room_id || '',
    check_in: booking?.check_in || '',
    check_out: booking?.check_out || '',
    total_price: Number(booking?.total_price || 0),
    status: booking?.status || 'Confirmed',
  });
  const [availableRooms, setAvailableRooms] = useState<Room[]>(rooms);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (formData.check_in && formData.check_out) checkRoomAvailability();
    else setAvailableRooms(rooms);
  }, [formData.check_in, formData.check_out, rooms]);

  const checkRoomAvailability = async () => {
    if (!formData.check_in || !formData.check_out) return;
    try {
      const { data: overlapping } = await supabase
        .from('bookings')
        .select('room_id')
        .or(`and(check_in.lte.${formData.check_out},check_out.gte.${formData.check_in})`);
      const bookedIds = overlapping?.map(b => b.room_id) ?? [];
      const available = rooms.filter(r => !bookedIds.includes(r.id) || (booking && booking.room_id === r.id));
      setAvailableRooms(available);
      if (formData.room_id && !available.find(r => r.id === formData.room_id)) {
        setFormData(prev => ({ ...prev, room_id: '' }));
      }
    } catch (err) {
      console.error('Error checking availability:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const bookingData = {
        guest_name: formData.guest_name,
        guest_email: formData.guest_email,
        room_id: formData.room_id,
        check_in: formData.check_in,
        check_out: formData.check_out,
        total_price: Number(formData.total_price || 0),
        status: formData.status,
      };

      if (booking) {
        const { error } = await supabase.from('bookings').update(bookingData).eq('id', booking.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bookings')
          .insert([{ ...bookingData, booking_token: generateBookingToken() }]);
        if (error) throw error;
      }
      onSave();
    } catch (err) {
      console.error('Error saving booking:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl"
        style={{ border: '1px solid rgba(212,230,234,0.9)' }}
      >
        <div
          className="flex items-center justify-between px-6 pt-6 pb-5"
          style={{ borderBottom: '1px solid #F1F5F9' }}
        >
          <h3 className="text-[17px] font-bold text-slate-800 tracking-tight">
            {booking ? 'Edit Booking' : 'New Booking'}
          </h3>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Guest Name *
              </label>
              <input
                type="text"
                required
                value={formData.guest_name}
                onChange={e => setFormData({ ...formData, guest_name: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary focus:ring-2 focus:ring-roameoPrimary/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Guest Email
              </label>
              <input
                type="email"
                value={formData.guest_email}
                onChange={e => setFormData({ ...formData, guest_email: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary focus:ring-2 focus:ring-roameoPrimary/20"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Check In *
              </label>
              <input
                type="date"
                required
                value={formData.check_in}
                onChange={e => setFormData({ ...formData, check_in: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Check Out *
              </label>
              <input
                type="date"
                required
                value={formData.check_out}
                onChange={e => setFormData({ ...formData, check_out: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Room *
              </label>
              <select
                required
                value={formData.room_id}
                onChange={e => setFormData({ ...formData, room_id: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary"
              >
                <option value="">Select a room</option>
                {availableRooms.map(room => (
                  <option key={room.id} value={room.id}>
                    {room.room_number} — {formatCurrency(room.price)}/night
                  </option>
                ))}
              </select>
              {(!formData.check_in || !formData.check_out) && (
                <p className="mt-1 text-xs text-slate-400">Select dates first to see available rooms.</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Total Price
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.total_price ?? 0}
                onChange={e => setFormData({ ...formData, total_price: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary"
              >
                {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)', boxShadow: '0 4px 14px rgba(79,111,118,0.30)' }}
            >
              {saving ? 'Saving…' : 'Save Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── AddMenuModal ─────────────────────────────────────────────────────────────

interface MenuItemRow { id: string; name: string; price: number; category: string; }

const INPUT_CLS = 'block w-full rounded-lg border border-roameoBorder bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-roameoAccent/40 focus:border-roameoAccent transition';

const AddMenuModal: React.FC<{
  bookingId: string;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ bookingId, onClose, showToast }) => {
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('menu_items').select('*').order('category').order('name')
      .then(({ data }) => { setMenuItems(data ?? []); setLoading(false); });
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, MenuItemRow[]> = {};
    for (const item of menuItems) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [menuItems]);

  const setQty = (id: string, val: number) =>
    setQuantities(prev => ({ ...prev, [id]: Math.max(0, val) }));

  const total = menuItems.reduce((s, item) => s + (quantities[item.id] ?? 0) * item.price, 0);
  const hasItems = Object.values(quantities).some(q => q > 0);

  const handleSave = async () => {
    if (!bookingId) {
      showToast('Invalid booking ID', 'error');
      return;
    }

    console.log('Booking ID:', bookingId);

    const payload = menuItems
      .filter(item => (quantities[item.id] ?? 0) > 0)
      .map(item => ({
        booking_id: bookingId,
        menu_item_id: item.id,
        quantity: quantities[item.id],
        price: item.price,
      }));

    if (payload.length === 0) {
      showToast('No items selected', 'error');
      return;
    }

    console.log('Selected items:', payload);

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('booking_items')
        .insert(payload)
        .select();

      if (error) {
        console.error('INSERT ERROR:', error);
        showToast(error.message, 'error');
        throw error;
      }

      console.log('Inserted items:', data);

      // Re-read ALL booking_items for this booking, then recalculate total
      const { data: allItems } = await supabase
        .from('booking_items')
        .select('quantity, price')
        .eq('booking_id', bookingId);

      const menuTotal = (allItems ?? []).reduce(
        (sum: number, i: { quantity: number; price: number }) => sum + i.quantity * i.price,
        0,
      );

      const { data: booking } = await supabase
        .from('bookings')
        .select('total_price')
        .eq('id', bookingId)
        .single();

      if (booking) {
        await supabase
          .from('bookings')
          .update({ total_price: Number(booking.total_price ?? 0) + menuTotal })
          .eq('id', bookingId);
      }

      showToast('Menu items added to booking');
      onClose();
    } catch (err: any) {
      console.error('Error adding menu items:', err);
      showToast(err.message || 'Insert failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden flex flex-col"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-roameoAccent" /> Add Room Service
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <div className="h-7 w-7 rounded-full border-2 border-roameoPrimary" style={{ borderTopColor: 'transparent', animation: 'spin-ring 0.75s linear infinite' }} />
            </div>
          ) : menuItems.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">No menu items configured yet.</p>
          ) : (
            Object.keys(grouped).sort().map(cat => (
              <div key={cat}>
                <p className="text-xs font-bold text-roameoMuted uppercase tracking-widest mb-2">{cat}</p>
                <div className="space-y-2">
                  {grouped[cat].map(item => {
                    const qty = quantities[item.id] ?? 0;
                    return (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: qty > 0 ? '#F0FDF9' : '#F8FAFC', border: `1px solid ${qty > 0 ? '#A7F3D0' : '#F1F5F9'}` }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                          <p className="text-xs text-slate-400">{formatCurrency(item.price)}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setQty(item.id, qty - 1)}
                            disabled={qty === 0}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-roameoBorder transition disabled:opacity-30"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={qty}
                            onChange={e => setQty(item.id, Number(e.target.value))}
                            className={INPUT_CLS + ' w-14 text-center py-1 text-sm font-semibold'}
                          />
                          <button
                            onClick={() => setQty(item.id, qty + 1)}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-roameoBorder transition"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 space-y-3" style={{ borderTop: '1px solid #F1F5F9' }}>
          {total > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Total to add</span>
              <span className="font-bold text-roameoAccent">{formatCurrency(total)}</span>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !hasItems}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)' }}
            >
              {saving ? 'Saving…' : 'Add to Booking'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-roameoBorder text-sm font-semibold text-slate-600 hover:bg-roameoSurface transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Bookings Page ───────────────────────────────────────────────────────

export const Bookings: React.FC = () => {
  const [view, setView] = useState<'availability' | 'list'>('availability');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptBooking | null>(null);
  const [addMenuBookingId, setAddMenuBookingId] = useState<string | null>(null);
  const [viewingProof, setViewingProof] = useState<{ url: string | null; guestName: string } | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<{
    bookingId: string;
    newStatus: 'Completed' | 'Cancelled';
    guestName: string;
  } | null>(null);
  const { toasts, showToast } = useToast();

  useEffect(() => { fetchBookings(); fetchRooms(); }, []);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`*, rooms (id, room_number, room_type, price)`)
        .in('status', ['Pending', 'Confirmed', 'Checked-in'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBookings(data ?? []);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const { data } = await supabase.from('rooms').select('id, room_number, price').eq('status', 'Available');
      setRooms(data ?? []);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  // ── Inline status change with feedback intercept ─────────────────────────────
  const handleStatusChange = (id: string, newStatus: string, guestName: string) => {
    if (newStatus === 'Completed' || newStatus === 'Cancelled') {
      setPendingFeedback({ bookingId: id, newStatus, guestName });
      return;
    }
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
    supabase.from('bookings').update({ status: newStatus }).eq('id', id)
      .then(({ error }) => {
        if (error) { fetchBookings(); showToast(error.message || 'Failed to update status', 'error'); }
        else showToast('Status updated');
      });
  };

  const commitPendingStatus = async () => {
    if (!pendingFeedback) return;
    const { bookingId, newStatus } = pendingFeedback;
    try {
      const { error } = await supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId);
      if (error) throw error;
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      showToast(`Booking ${newStatus.toLowerCase()}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    } finally {
      setPendingFeedback(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this booking?')) return;
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
      setBookings(prev => prev.filter(b => b.id !== id));
      showToast('Booking deleted');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete booking', 'error');
    }
  };

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
      {/* ── Page header + tabs ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage all room reservations, guest details, and advance payments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div
            className="flex items-center rounded-xl p-1"
            style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}
          >
            <button
              onClick={() => setView('availability')}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                view === 'availability'
                  ? 'bg-white text-roameoAccent shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Availability
            </button>
            <button
              onClick={() => setView('list')}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                view === 'list'
                  ? 'bg-white text-roameoAccent shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>

          {view === 'list' && (
            <button
              onClick={() => { setEditingBooking(null); setShowModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)', boxShadow: '0 4px 12px rgba(79,111,118,0.28)' }}
            >
              <Plus className="h-4 w-4" />
              New Booking
            </button>
          )}
        </div>
      </div>

      {/* ── Availability grid ── */}
      {view === 'availability' && <RoomAvailabilityGrid />}

      {/* ── List view ── */}
      {view === 'list' && (
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
            border: '1px solid rgba(212,230,234,0.6)',
          }}
        >
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
                  <th className="relative py-3.5 pl-3 pr-5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bookings.map(booking => (
                  <tr key={booking.id} className="hover:bg-roameoSurface/50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-5 pr-3 text-sm">
                      <div className="font-semibold text-slate-800">{booking.booking_token}</div>
                      <div className="text-slate-400 text-xs mt-0.5">{booking.guest_name}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-700">
                      {booking.rooms?.room_number}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500">
                      <div className="text-xs">In: <span className="font-medium text-slate-700">{booking.check_in}</span></div>
                      <div className="text-xs mt-0.5">Out: <span className="font-medium text-slate-700">{booking.check_out}</span></div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-700">
                      {formatCurrency(booking.total_price)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      {/* Only show current status + allowed next statuses */}
                      {(() => {
                        const allowed = ALLOWED_TRANSITIONS[booking.status] ?? [];
                        const terminal = allowed.length === 0;
                        return terminal ? (
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[booking.status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {booking.status}
                          </span>
                        ) : (
                          <select
                            value={booking.status}
                            onChange={e => handleStatusChange(booking.id, e.target.value, booking.guest_name)}
                            className={`text-xs font-semibold rounded-full px-2.5 py-1 border-0 outline-none cursor-pointer appearance-none transition-colors ${
                              STATUS_STYLES[booking.status] ?? 'bg-slate-100 text-slate-600'
                            }`}
                            style={{ minHeight: 28 }}
                          >
                            <option value={booking.status}>{booking.status}</option>
                            {allowed.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        );
                      })()}
                    </td>
                    <td className="whitespace-nowrap py-4 pl-3 pr-5 text-right text-sm">
                      <button
                        onClick={() => setViewingReceipt(toReceiptBooking(booking))}
                        title="View Receipt"
                        className="text-roameoMuted hover:text-roameoAccent mr-3 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewingProof({ url: booking.payment_proof_url ?? null, guestName: booking.guest_name })}
                        title="View Payment Proof"
                        className={`mr-3 transition-colors ${booking.payment_proof_url ? 'text-roameoMuted hover:text-roameoAccent' : 'text-slate-200 hover:text-slate-400'}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setAddMenuBookingId(booking.id)}
                        title="Add Room Service"
                        className="text-roameoMuted hover:text-roameoAccent mr-3 transition-colors"
                      >
                        <UtensilsCrossed className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setEditingBooking(booking); setShowModal(true); }}
                        className="text-roameoMuted hover:text-roameoAccent mr-3 transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(booking.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                      No bookings yet. Use the Availability grid to make a booking.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <BookingModal
          booking={editingBooking}
          rooms={rooms}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            showToast(editingBooking ? 'Booking updated' : 'Booking created');
            fetchBookings();
          }}
        />
      )}

      {viewingReceipt && (
        <BookingConfirmationCard
          booking={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
          onStatusChange={(id, status, confirmed_token) => {
            setBookings(prev =>
              prev.map(b =>
                b.id === id
                  ? { ...b, status, confirmed_token: confirmed_token ?? b.confirmed_token }
                  : b,
              ),
            );
            setViewingReceipt(prev =>
              prev ? { ...prev, status, confirmed_token: confirmed_token ?? prev.confirmed_token } : prev,
            );
          }}
        />
      )}

      {addMenuBookingId && (
        <AddMenuModal
          bookingId={addMenuBookingId}
          onClose={() => { setAddMenuBookingId(null); fetchBookings(); }}
          showToast={showToast}
        />
      )}

      {/* Payment proof modal */}
      {viewingProof && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl"
            style={{ border: '1px solid rgba(212,230,234,0.9)' }}
          >
            <div
              className="flex items-center justify-between px-6 pt-6 pb-5"
              style={{ borderBottom: '1px solid #F1F5F9' }}
            >
              <div>
                <h3 className="text-[17px] font-bold text-slate-800 tracking-tight">Payment Proof</h3>
                <p className="text-xs text-slate-400 mt-0.5">{viewingProof.guestName}</p>
              </div>
              <button
                onClick={() => setViewingProof(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              {viewingProof.url ? (
                <img
                  src={viewingProof.url}
                  alt="Payment proof"
                  className="w-full rounded-xl object-contain max-h-[420px] border border-roameoBorder"
                />
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-12 rounded-xl"
                  style={{ background: '#F5F9FA' }}
                >
                  <Eye className="h-8 w-8 text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500">No payment proof uploaded</p>
                  <p className="text-xs text-slate-400 mt-1">The guest has not submitted a payment image yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingFeedback && (
        <FeedbackModal
          bookingId={pendingFeedback.bookingId}
          type={pendingFeedback.newStatus === 'Completed' ? 'completed' : 'cancelled'}
          guestName={pendingFeedback.guestName}
          onSubmit={commitPendingStatus}
          onSkip={commitPendingStatus}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
};
