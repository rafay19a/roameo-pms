import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, generateBookingToken } from '../lib/utils';
import { Plus, Edit, Trash2, CalendarDays, List } from 'lucide-react';
import { RoomAvailabilityGrid } from '../components/RoomAvailabilityGrid';

interface Booking {
  id: string;
  booking_token: string;
  guest_name: string;
  guest_email: string;
  room_id: string;
  check_in: string;
  check_out: string;
  total_price: number;
  status: string;
  rooms: { room_number: string; price: number };
}

interface Room {
  id: string;
  room_number: string;
  price: number;
}

const BookingModal = ({ booking, rooms, onClose, onSave }: { booking: Booking | null, rooms: Room[], onClose: () => void, onSave: () => void }) => {
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

  useEffect(() => {
    if (formData.check_in && formData.check_out) {
      checkRoomAvailability();
    } else {
      setAvailableRooms(rooms);
    }
  }, [formData.check_in, formData.check_out, rooms]);

  const checkRoomAvailability = async () => {
    if (!formData.check_in || !formData.check_out) return;

    try {
      const { data: overlappingBookings, error } = await supabase
        .from('bookings')
        .select('room_id')
        .or(`and(check_in.lte.${formData.check_out},check_out.gte.${formData.check_in})`);

      if (error) {
        console.error(error);
        return;
      }

      const bookedRoomIds = overlappingBookings?.map(b => b.room_id) || [];
      
      const available = rooms.filter(room => 
        !bookedRoomIds.includes(room.id) || (booking && booking.room_id === room.id)
      );
      
      setAvailableRooms(available);

      if (formData.room_id && !available.find(r => r.id === formData.room_id)) {
        setFormData(prev => ({ ...prev, room_id: '' }));
      }
    } catch (error) {
      console.error('Error checking availability:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        const { error } = await supabase
          .from('bookings')
          .update(bookingData)
          .eq('id', booking.id);
        if (error) {
          console.error(error);
          return;
        }
      } else {
        const newBookingData = {
          ...bookingData,
          booking_token: generateBookingToken(),
        };
        const { error } = await supabase
          .from('bookings')
          .insert([newBookingData]);
        if (error) {
          console.error(error);
          return;
        }
      }

      onSave();
    } catch (error) {
      console.error('Error saving booking:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

        <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6 sm:align-middle">
          <div>
            <h3 className="text-lg font-medium leading-6 text-slate-900">
              {booking ? 'Edit Booking' : 'New Booking'}
            </h3>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Guest Name</label>
                  <input
                    type="text"
                    required
                    value={formData.guest_name}
                    onChange={(e) => setFormData({...formData, guest_name: e.target.value})}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Guest Email</label>
                  <input
                    type="email"
                    value={formData.guest_email}
                    onChange={(e) => setFormData({...formData, guest_email: e.target.value})}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700">Check In</label>
                  <input
                    type="date"
                    required
                    value={formData.check_in}
                    onChange={(e) => setFormData({...formData, check_in: e.target.value})}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Check Out</label>
                  <input
                    type="date"
                    required
                    value={formData.check_out}
                    onChange={(e) => setFormData({...formData, check_out: e.target.value})}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Room</label>
                  <select
                    required
                    value={formData.room_id}
                    onChange={(e) => setFormData({...formData, room_id: e.target.value})}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
                  >
                    <option value="">Select a room</option>
                    {availableRooms && availableRooms.map(room => (
                      <option key={room.id} value={room.id}>
                        {room.room_number} - {formatCurrency(room.price)}/night
                      </option>
                    ))}
                  </select>
                  {(!formData.check_in || !formData.check_out) && (
                    <p className="mt-1 text-xs text-slate-500">Please select dates to see available rooms.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Total Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.total_price ?? 0}
                    onChange={(e) => setFormData({...formData, total_price: Number(e.target.value)})}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Pending">Pending</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                <button
                  type="submit"
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
                >
                  Save Booking
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Bookings: React.FC = () => {
  const [view, setView] = useState<'availability' | 'list'>('availability');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  useEffect(() => {
    fetchBookings();
    fetchRooms();
  }, []);

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          rooms (
            id,
            room_number,
            price
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error(error);
        setBookings([]);
        return;
      }
      if (!data) {
        setBookings([]);
        return;
      }
      setBookings(data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, room_number, price')
        .eq('status', 'Available');
      
      if (error) {
        console.error(error);
        setRooms([]);
        return;
      }
      setRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setRooms([]);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this booking?')) return;
    
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error(error);
        return;
      }
      fetchBookings();
    } catch (error) {
      console.error('Error deleting booking:', error);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="h-8 w-8 rounded-full border-2 border-roameoPrimary" style={{ borderTopColor: 'transparent', animation: 'spin-ring 0.75s linear infinite' }} />
    </div>
  );

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

          {/* New booking button — only shown in list view */}
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

      {/* ── Availability grid view ── */}
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
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        booking.status === 'Confirmed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : booking.status === 'Cancelled'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {booking.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-4 pl-3 pr-5 text-right text-sm">
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
      )}

      {showModal && (
        <BookingModal
          booking={editingBooking}
          rooms={rooms}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); fetchBookings(); }}
        />
      )}
    </div>
  );
};

