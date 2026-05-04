import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
  status: string;
}

const RoomModal = ({ room, onClose, onSave }: { room: Room | null, onClose: () => void, onSave: () => void }) => {
  const [formData, setFormData] = useState({
    room_number: room?.room_number || '',
    room_type: room?.room_type || 'Deluxe',
    price: Number(room?.price || 0),
    status: room?.status || 'Available',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const roomData = {
        room_number: formData.room_number,
        room_type: formData.room_type,
        price: Number(formData.price),
        status: formData.status,
      };

      if (room) {
        const { error } = await supabase
          .from('rooms')
          .update(roomData)
          .eq('id', room.id);
        if (error) {
          console.error(error);
          return;
        }
      } else {
        const { error } = await supabase
          .from('rooms')
          .insert([roomData]);
        if (error) {
          console.error(error);
          return;
        }
      }

      onSave();
    } catch (error) {
      console.error('Error saving room:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="relative flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

        \<div className="inline-block w-full max-w-lg transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:p-6">
          <div>
            <h3 className="text-lg font-medium leading-6 text-slate-900">
              {room ? 'Edit Room' : 'Add New Room'}
            </h3>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="room_number" className="block text-sm font-medium text-slate-700">Room Number</label>
                <input
                  type="text"
                  id="room_number"
                  required
                  value={formData.room_number}
                  onChange={(e) => setFormData({...formData, room_number: e.target.value})}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
                />
              </div>
              <div>
                <label htmlFor="room_type" className="block text-sm font-medium text-slate-700">Room Type</label>
                <select
                  id="room_type"
                  value={formData.room_type}
                  onChange={(e) => setFormData({...formData, room_type: e.target.value})}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
                >
                  <option>Deluxe</option>
                  <option>Executive</option>
                  <option>Suite</option>
                </select>
              </div>
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-slate-700">Price per Night</label>
                <input
                  type="number"
                  id="price"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price ?? 0}
                  onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
                />
              </div>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-slate-700">Status</label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
                >
                  <option>Available</option>
                  <option>Maintenance</option>
                </select>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                <button
                  type="submit"
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
                >
                  Save
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

export const Rooms: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number');
      
      if (error) {
        console.error(error);
        setRooms([]);
        return;
      }
      if (!data) {
        setRooms([]);
        return;
      }
      setRooms(data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error(error);
        return;
      }
      fetchRooms();
    } catch (error) {
      console.error('Error deleting room:', error);
    }
  };

  if (loading) return <div>Loading rooms...</div>;

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-slate-900">Rooms</h1>
          <p className="mt-2 text-sm text-slate-700">
            A list of all rooms in the resort including their number, type, price, and status.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => {
              setEditingRoom(null);
              setShowModal(true);
            }}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Room
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-slate-300">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">
                      Room Number
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Type
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Price / Night
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Status
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rooms && rooms.map((room) => (
                    <tr key={room.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                        {room.room_number}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                        {room.room_type}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                        {formatCurrency(room.price)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          room.status === 'Available' ? 'bg-green-100 text-green-800' : 
                          room.status === 'Maintenance' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {room.status}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => {
                            setEditingRoom(room);
                            setShowModal(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(room.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <RoomModal
          room={editingRoom}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            fetchRooms();
          }}
        />
      )}
    </div>
  );
};
