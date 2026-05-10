import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
  status: string;
}

interface RoomModalProps {
  room: Room | null;
  onClose: () => void;
  onSave: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const RoomModal: React.FC<RoomModalProps> = ({ room, onClose, onSave, showToast }) => {
  const [formData, setFormData] = useState({
    room_number: room?.room_number || '',
    room_type: room?.room_type || 'Deluxe',
    price: Number(room?.price || 0),
    status: room?.status || 'Available',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const roomData = {
        room_number: formData.room_number,
        room_type: formData.room_type,
        price: Number(formData.price),
        status: formData.status,
      };

      if (room) {
        console.log('[Rooms] Updating room status:', room.id, '→', roomData.status);
        const { data, error } = await supabase
          .from('rooms')
          .update(roomData)
          .eq('id', room.id)
          .select();
        console.log('[Rooms] DB response:', { data, error });
        if (error) throw error;
        showToast('Room updated successfully');
      } else {
        const { data, error } = await supabase.from('rooms').insert([roomData]).select();
        console.log('[Rooms] insert response:', { data, error });
        if (error) throw error;
        showToast('Room added successfully');
      }

      onSave();
    } catch (err: any) {
      showToast(err.message || 'Failed to save room', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}>
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
        style={{ border: '1px solid rgba(212,230,234,0.9)' }}
      >
        <div className="px-6 pt-6 pb-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h3 className="text-[17px] font-bold text-slate-800 tracking-tight">
            {room ? 'Edit Room' : 'Add New Room'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Room Number *
            </label>
            <input
              type="text"
              required
              value={formData.room_number}
              onChange={e => setFormData({ ...formData, room_number: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary focus:ring-2 focus:ring-roameoPrimary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Room Type
              </label>
              <select
                value={formData.room_type}
                onChange={e => setFormData({ ...formData, room_type: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary"
              >
                <option>Deluxe</option>
                <option>Executive</option>
                <option>Suite</option>
              </select>
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
                <option>Available</option>
                <option>Maintenance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Price per Night *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.price ?? 0}
              onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary focus:ring-2 focus:ring-roameoPrimary/20"
            />
          </div>

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
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)', boxShadow: '0 4px 14px rgba(79,111,118,0.30)' }}
            >
              {saving ? 'Saving…' : 'Save Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const Rooms: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const { toasts, showToast } = useToast();

  useEffect(() => { fetchRooms(); }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number');
      if (error) throw error;
      (data ?? []).forEach(room => console.log("ROOM STATUS FROM DB:", room.status));
      setRooms(data ?? []);
    } catch (err) {
      console.error('Error fetching rooms:', err);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    try {
      const { error } = await supabase.from('rooms').delete().eq('id', id);
      if (error) throw error;
      setRooms(prev => prev.filter(r => r.id !== id));
      showToast('Room deleted');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete room', 'error');
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Rooms</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage all rooms — number, type, price, and availability status.
          </p>
        </div>
        <button
          onClick={() => { setEditingRoom(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98] self-start sm:self-auto"
          style={{ background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)', boxShadow: '0 4px 12px rgba(79,111,118,0.28)' }}
        >
          <Plus className="h-4 w-4" />
          Add Room
        </button>
      </div>

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
                  Room
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Price / Night
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
              {rooms.map(room => (
                <tr key={room.id} className="hover:bg-roameoSurface/50 transition-colors">
                  <td className="whitespace-nowrap py-4 pl-5 pr-3 text-sm font-semibold text-slate-800">
                    {room.room_number}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500">
                    {room.room_type}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-700">
                    {formatCurrency(room.price)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm">
                    {(() => {
                      const status = room.status;
                      return (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            status === 'Available'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {status}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="whitespace-nowrap py-4 pl-3 pr-5 text-right text-sm">
                    <button
                      onClick={() => { setEditingRoom(room); setShowModal(true); }}
                      className="text-roameoMuted hover:text-roameoAccent mr-3 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-slate-400">
                    No rooms yet. Add your first room to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <RoomModal
          room={editingRoom}
          onClose={() => setShowModal(false)}
          showToast={showToast}
          onSave={async () => { setShowModal(false); await fetchRooms(); }}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
};
