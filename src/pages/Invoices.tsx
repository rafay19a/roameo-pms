import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Printer, Plus } from 'lucide-react';

interface Invoice {
  id: string;
  booking_id: string;
  amount: number;
  status: string;
  created_at: string;
  bookings: {
    booking_token: string;
    guest_name: string;
    check_in: string;
    check_out: string;
    rooms: { room_number: string; price: number };
  };
}

const InvoiceModal = ({ bookings, onClose, onSave }: { bookings: any[], onClose: () => void, onSave: () => void }) => {
  const [selectedBooking, setSelectedBooking] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    setGenerating(true);
    try {
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', selectedBooking)
        .single();

      if (bookingError) {
        console.error(bookingError);
        return;
      }
      if (!booking) {
        console.error("Booking not found");
        return;
      }

      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          booking_id: selectedBooking,
          amount: Number(booking.total_price || 0),
          status: 'Unpaid'
        }]);

      if (invoiceError) {
        console.error(invoiceError);
        return;
      }

      onSave();
    } catch (error) {
      console.error('Error generating invoice:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto print:hidden">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

        <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
          <div>
            <h3 className="text-lg font-medium leading-6 text-slate-900">
              Generate Invoice
            </h3>
            <form onSubmit={handleGenerateInvoice} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Select Booking</label>
                <select
                  required
                  value={selectedBooking}
                  onChange={(e) => setSelectedBooking(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
                >
                  <option value="">Select a booking...</option>
                  {bookings && bookings.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.booking_token} - {b.guest_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                <button
                  type="submit"
                  disabled={generating || !selectedBooking}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Generate'}
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

export const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    fetchInvoices();
    fetchBookings();
  }, []);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          bookings (
            id,
            guest_name,
            booking_token
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error(error);
        setInvoices([]);
        return;
      }
      if (!data) {
        setInvoices([]);
        return;
      }
      setInvoices(data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      // Fetch bookings that don't have an invoice yet
      const { data: invoicedBookings, error: invoicedError } = await supabase.from('invoices').select('booking_id');
      if (invoicedError) {
        console.error(invoicedError);
        return;
      }
      
      const invoicedIds = invoicedBookings?.map(i => i.booking_id) || [];

      let query = supabase.from('bookings').select('id, booking_token, guest_name');
      
      if (invoicedIds.length > 0) {
        query = query.not('id', 'in', `(${invoicedIds.join(',')})`);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error(error);
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
    }
  };

  const handlePrint = (invoiceId: string) => {
    window.print();
  };

  if (loading) return <div>Loading invoices...</div>;

  return (
    <div>
      <div className="sm:flex sm:items-center print:hidden">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
          <p className="mt-2 text-sm text-slate-700">
            Manage and print guest invoices.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Generate Invoice
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-col print:mt-0">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg print:shadow-none print:ring-0">
              <table className="min-w-full divide-y divide-slate-300">
                <thead className="bg-slate-50 print:bg-white">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">
                      Invoice ID / Date
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Booking / Guest
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Amount
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Status
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 print:hidden">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {invoices && invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                        <div className="font-medium text-slate-900">{invoice.id.substring(0, 8)}</div>
                        <div className="text-slate-500">{new Date(invoice.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                        <div className="font-medium text-slate-900">{invoice.bookings?.booking_token}</div>
                        <div>{invoice.bookings?.guest_name}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-slate-900">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          invoice.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 print:hidden">
                        <button
                          onClick={() => handlePrint(invoice.id)}
                          className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end w-full"
                        >
                          <Printer className="h-4 w-4 mr-1" /> Print
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
        <InvoiceModal
          bookings={bookings}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            fetchInvoices();
            fetchBookings();
          }}
        />
      )}
    </div>
  );
};
