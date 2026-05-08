import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { Printer, Plus, CheckCircle, FileText, X, Download } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';
import html2pdf from 'html2pdf.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvoiceRow {
  id: string;
  booking_id: string;
  amount: number;
  status: string;
  created_at: string;
  bookings: {
    booking_token: string;
    guest_name: string;
  } | null;
}

interface BookingDetail {
  id: string;
  booking_token: string;
  guest_name: string;
  guest_phone?: string;
  check_in: string;
  check_out: string;
  total_price: number;
  advance_amount?: number;
  rooms: { room_number: string; room_type: string; price: number } | null;
  booking_items: {
    quantity: number;
    price: number;
    menu_items: { name: string } | null;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEAL_BTN: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)',
};

const INPUT_CLS = 'block w-full rounded-lg border border-roameoBorder bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-roameoAccent/40 focus:border-roameoAccent transition';

function diffDays(a: string, b: string): number {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── PrintInvoiceModal ────────────────────────────────────────────────────────

interface PrintModalProps {
  invoiceId: string;
  invoiceDate: string;
  invoiceStatus: string;
  onClose: () => void;
}

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; color: #1f2937; padding: 20px; }
  .inv { max-width: 600px; margin: 0 auto; }
  .header { background: #6b8f94; color: #fff; padding: 24px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left p { font-size: 11px; opacity: .7; text-transform: uppercase; letter-spacing: .06em; }
  .header-left h1 { font-size: 22px; font-weight: 700; margin-top: 4px; }
  .header-left small { font-size: 12px; opacity: .6; display: block; margin-top: 4px; }
  .badge { padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .badge-paid { background: rgba(22,163,74,.25); color: #fff; }
  .badge-unpaid { background: rgba(202,138,4,.25); color: #fff; }
  .body { border: 1px solid #d4e6ea; border-top: none; border-radius: 0 0 12px 12px; padding: 20px 24px; }
  .section { font-size: 10px; font-weight: 700; color: #8aadb5; text-transform: uppercase; letter-spacing: .08em; margin: 16px 0 8px; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
  .row .lbl { color: #64748b; }
  .row .val { font-weight: 500; color: #1e293b; }
  .sep-dashed { border: none; border-top: 1px dashed #d4e6ea; margin: 10px 0; }
  .sep-solid  { border: none; border-top: 1px solid #d4e6ea; margin: 10px 0; }
  .total-row { display: flex; justify-content: space-between; padding: 10px 0 0; font-size: 15px; font-weight: 700; color: #2d4a51; border-top: 2px solid #d4e6ea; margin-top: 6px; }
  .green { color: #16a34a; }
  .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 20px; }
`;

function buildInvoiceHTML(
  detail: BookingDetail,
  invoiceDate: string,
  invoiceStatus: string,
  nights: number,
  roomCharge: number,
  grandTotal: number,
  advance: number,
  balance: number,
): string {
  const menuRows = (detail.booking_items ?? [])
    .map(bi => `
      <div class="row">
        <span class="lbl">${bi.menu_items?.name ?? 'Item'} × ${bi.quantity}</span>
        <span class="val">${formatCurrency(bi.price * bi.quantity)}</span>
      </div>`)
    .join('');

  const menuSection = menuRows
    ? `<hr class="sep-dashed"/>
       <div class="section">Room Service</div>
       ${menuRows}`
    : '';

  const advanceRow = advance > 0
    ? `<div class="row"><span class="lbl">Advance paid</span><span class="val green">− ${formatCurrency(advance)}</span></div>`
    : '';

  const badgeCls = invoiceStatus === 'Paid' ? 'badge-paid' : 'badge-unpaid';

  return `
    <div class="inv">
      <div class="header">
        <div class="header-left">
          <p>Roameo Resorts &amp; Hotels</p>
          <h1>${detail.booking_token}</h1>
          <small>${fmtDate(invoiceDate)}</small>
        </div>
        <span class="badge ${badgeCls}">${invoiceStatus}</span>
      </div>
      <div class="body">
        <div class="section">Guest</div>
        <div class="row"><span class="lbl">Name</span><span class="val">${detail.guest_name}</span></div>
        ${detail.guest_phone ? `<div class="row"><span class="lbl">Phone</span><span class="val">${detail.guest_phone}</span></div>` : ''}

        <hr class="sep-dashed"/>
        <div class="section">Stay Details</div>
        <div class="row"><span class="lbl">Room</span><span class="val">#${detail.rooms?.room_number ?? '—'} · ${detail.rooms?.room_type ?? '—'}</span></div>
        <div class="row"><span class="lbl">Check-in</span><span class="val">${fmtDate(detail.check_in)}</span></div>
        <div class="row"><span class="lbl">Check-out</span><span class="val">${fmtDate(detail.check_out)}</span></div>
        <div class="row"><span class="lbl">Nights</span><span class="val">${nights}</span></div>
        <div class="row"><span class="lbl">Room charge</span><span class="val">${formatCurrency(detail.rooms?.price ?? 0)} × ${nights} = ${formatCurrency(roomCharge)}</span></div>

        ${menuSection}

        <hr class="sep-solid"/>
        <div class="row"><span class="lbl">Subtotal</span><span class="val">${formatCurrency(grandTotal)}</span></div>
        ${advanceRow}
        <div class="total-row"><span>Balance due</span><span>${formatCurrency(balance)}</span></div>

        <div class="footer">Thank you for staying with Roameo Resorts</div>
      </div>
    </div>`;
}

const Row: React.FC<{ label: string; value: string; green?: boolean }> = ({ label, value, green }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
    <span style={{ color: '#64748B' }}>{label}</span>
    <span style={{ fontWeight: 500, color: green ? '#16A34A' : '#1E293B' }}>{value}</span>
  </div>
);

const Sep: React.FC<{ dashed?: boolean }> = ({ dashed }) => (
  <hr style={{ border: 'none', borderTop: `1px ${dashed ? 'dashed' : 'solid'} #D4E6EA`, margin: '10px 0' }} />
);

const PrintInvoiceModal: React.FC<PrintModalProps> = ({ invoiceId, invoiceDate, invoiceStatus, onClose }) => {
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: inv } = await supabase
          .from('invoices')
          .select('booking_id')
          .eq('id', invoiceId)
          .single();
        if (!inv?.booking_id) { setLoading(false); return; }

        const { data, error } = await supabase
          .from('bookings')
          .select(`
            id, booking_token, guest_name, guest_phone,
            check_in, check_out, total_price, advance_amount,
            rooms (room_number, room_type, price),
            booking_items (quantity, price, menu_items:menu_item_id (name))
          `)
          .eq('id', inv.booking_id)
          .single();

        if (error) throw error;
        setDetail(data as unknown as BookingDetail);
      } catch (err) {
        console.error('Error loading invoice detail:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId]);

  const nights     = detail ? diffDays(detail.check_in, detail.check_out) : 0;
  const roomCharge = detail?.rooms ? detail.rooms.price * nights : 0;
  const menuTotal  = detail?.booking_items?.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0;
  const grandTotal = roomCharge + menuTotal;
  const advance    = detail?.advance_amount ?? 0;
  const balance    = Math.max(0, grandTotal - advance);

  const getHTML = () =>
    detail
      ? buildInvoiceHTML(detail, invoiceDate, invoiceStatus, nights, roomCharge, grandTotal, advance, balance)
      : '';

  const handlePrint = () => {
    if (!detail) return;
    const w = window.open('', '', 'width=900,height=700');
    if (!w) return;
    w.document.write(`<html><head><title>Invoice</title><style>${PRINT_CSS}</style></head><body>${getHTML()}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const handleDownload = () => {
    if (!detail || !printRef.current) return;
    html2pdf()
      .from(printRef.current)
      .set({
        margin: 10,
        filename: `invoice-${detail.booking_token}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .save();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl overflow-hidden flex flex-col"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh' }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="h-4 w-4 text-roameoAccent" /> Invoice Detail
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-8 w-8 rounded-full border-2 border-roameoPrimary" style={{ borderTopColor: 'transparent', animation: 'spin-ring 0.75s linear infinite' }} />
            </div>
          ) : !detail ? (
            <p className="text-center text-slate-400 py-10">Could not load invoice details.</p>
          ) : (
            /* Printable area — html2pdf reads this element directly */
            <div ref={printRef} id="invoice-print">
              <div>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#6F8F97,#4F6F76)', borderRadius: '12px 12px 0 0', padding: '24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: 11, opacity: .7, textTransform: 'uppercase', letterSpacing: '.06em' }}>Roameo Resorts</p>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{detail.booking_token}</h2>
                    <p style={{ fontSize: 12, opacity: .6, marginTop: 4 }}>{fmtDate(invoiceDate)}</p>
                  </div>
                  <span style={{ padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: invoiceStatus === 'Paid' ? 'rgba(22,163,74,.25)' : 'rgba(202,138,4,.25)', color: '#fff' }}>
                    {invoiceStatus}
                  </span>
                </div>

                {/* Body */}
                <div style={{ border: '1px solid #D4E6EA', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '20px 24px' }}>

                  <p style={{ fontSize: 10, fontWeight: 700, color: '#8AADB5', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Guest</p>
                  <Row label="Name" value={detail.guest_name} />
                  {detail.guest_phone && <Row label="Phone" value={detail.guest_phone} />}

                  <Sep dashed />

                  <p style={{ fontSize: 10, fontWeight: 700, color: '#8AADB5', textTransform: 'uppercase', letterSpacing: '.08em', margin: '16px 0 8px' }}>Stay Details</p>
                  <Row label="Room" value={`#${detail.rooms?.room_number ?? '—'} · ${detail.rooms?.room_type ?? '—'}`} />
                  <Row label="Check-in" value={fmtDate(detail.check_in)} />
                  <Row label="Check-out" value={fmtDate(detail.check_out)} />
                  <Row label="Nights" value={String(nights)} />
                  <Row label="Room charge" value={`${formatCurrency(detail.rooms?.price ?? 0)} × ${nights} = ${formatCurrency(roomCharge)}`} />

                  {(detail.booking_items ?? []).length > 0 && (
                    <>
                      <Sep dashed />
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#8AADB5', textTransform: 'uppercase', letterSpacing: '.08em', margin: '16px 0 8px' }}>Room Service</p>
                      {detail.booking_items.map((bi, i) => (
                        <Row key={i} label={`${bi.menu_items?.name ?? 'Item'} × ${bi.quantity}`} value={formatCurrency(bi.price * bi.quantity)} />
                      ))}
                    </>
                  )}

                  <Sep />
                  <Row label="Subtotal" value={formatCurrency(grandTotal)} />
                  {advance > 0 && <Row label="Advance paid" value={`− ${formatCurrency(advance)}`} green />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 15, fontWeight: 700, color: '#2D4A51', borderTop: '2px solid #D4E6EA', marginTop: 6 }}>
                    <span>Balance due</span>
                    <span style={{ color: '#4F6F76' }}>{formatCurrency(balance)}</span>
                  </div>

                  <p style={{ textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 20 }}>Thank you for staying with Roameo Resorts</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!loading && detail && (
          <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid #F1F5F9' }}>
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={TEAL_BTN}
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#4F6F76,#2D4A51)' }}
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-roameoBorder text-sm font-semibold text-slate-600 hover:bg-roameoSurface transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── GenerateModal ────────────────────────────────────────────────────────────

interface GenerateModalProps {
  bookings: { id: string; booking_token: string; guest_name: string }[];
  onClose: () => void;
  onSave: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const GenerateModal: React.FC<GenerateModalProps> = ({ bookings, onClose, onSave, showToast }) => {
  const [selectedBooking, setSelectedBooking] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    setGenerating(true);
    try {
      const { data: booking, error: bErr } = await supabase
        .from('bookings')
        .select(`
          total_price, check_in, check_out, advance_amount,
          rooms (price),
          booking_items (quantity, price)
        `)
        .eq('id', selectedBooking)
        .single();

      if (bErr || !booking) throw bErr ?? new Error('Booking not found');

      // Recalculate total: room nights + menu items
      const rooms = (booking as any).rooms;
      const bookingItems: { quantity: number; price: number }[] = (booking as any).booking_items ?? [];
      const nights = diffDays(booking.check_in, booking.check_out);
      const roomCharge = rooms ? (rooms.price * nights) : Number(booking.total_price ?? 0);
      const menuTotal = bookingItems.reduce((s: number, i: { quantity: number; price: number }) => s + (i.price * i.quantity), 0);
      const total = roomCharge + menuTotal;

      const { error: iErr } = await supabase.from('invoices').insert([{
        booking_id: selectedBooking,
        amount: total,
        status: 'Unpaid',
      }]);
      if (iErr) throw iErr;

      showToast('Invoice generated');
      onSave();
    } catch (err: any) {
      console.error('Error generating invoice:', err);
      showToast('Failed to generate invoice', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-white rounded-2xl p-6"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
      >
        <h3 className="text-lg font-semibold text-slate-800 mb-5">Generate Invoice</h3>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Select Booking</label>
            <select
              required
              className={INPUT_CLS}
              value={selectedBooking}
              onChange={e => setSelectedBooking(e.target.value)}
            >
              <option value="">Choose a booking…</option>
              {bookings.map(b => (
                <option key={b.id} value={b.id}>
                  {b.booking_token} — {b.guest_name}
                </option>
              ))}
            </select>
            {bookings.length === 0 && (
              <p className="text-xs text-slate-400 mt-1.5">All bookings already have invoices.</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={generating || !selectedBooking}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              style={TEAL_BTN}
            >
              {generating ? 'Generating…' : 'Generate'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-roameoBorder text-sm font-semibold text-slate-600 hover:bg-roameoSurface transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Invoices page ────────────────────────────────────────────────────────────

export const Invoices: React.FC = () => {
  const [invoices, setInvoices]     = useState<InvoiceRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<InvoiceRow | null>(null);
  const [bookings, setBookings]     = useState<{ id: string; booking_token: string; guest_name: string }[]>([]);
  const { toasts, showToast }       = useToast();

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, bookings (booking_token, guest_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices(data ?? []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      showToast('Failed to load invoices', 'error');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const { data: invoiced } = await supabase.from('invoices').select('booking_id');
      const ids = invoiced?.map(i => i.booking_id).filter(Boolean) ?? [];

      let q = supabase.from('bookings').select('id, booking_token, guest_name').neq('status', 'Cancelled');
      if (ids.length > 0) q = q.not('id', 'in', `(${ids.join(',')})`);

      const { data, error } = await q;
      if (error) throw error;
      setBookings(data ?? []);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchBookings();
  }, []);

  const handleMarkPaid = async (id: string) => {
    const prev = invoices;
    setInvoices(p => p.map(i => i.id === id ? { ...i, status: 'Paid' } : i));
    try {
      const { error } = await supabase.from('invoices').update({ status: 'Paid' }).eq('id', id);
      if (error) throw error;
      showToast('Invoice marked as paid');
    } catch (err) {
      console.error('Error marking invoice paid:', err);
      setInvoices(prev);
      showToast('Failed to update invoice', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="h-9 w-9 rounded-full border-2 border-roameoPrimary"
          style={{ borderTopColor: 'transparent', animation: 'spin-ring 0.75s linear infinite' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and print guest invoices</p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
          style={TEAL_BTN}
        >
          <Plus className="h-4 w-4" />
          Generate Invoice
        </button>
      </div>

      {/* Table */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)', border: '1px solid rgba(212,230,234,0.6)' }}
      >
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FileText className="h-12 w-12 text-roameoMuted mb-4" />
            <p className="text-base font-semibold text-slate-600">No invoices yet</p>
            <p className="text-sm text-slate-400 mt-1">Generate an invoice for a booking</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide py-3.5 pl-6 pr-3">Invoice / Date</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide py-3.5 px-3">Booking · Guest</th>
                <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide py-3.5 px-3">Amount</th>
                <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wide py-3.5 px-3">Status</th>
                <th className="py-3.5 pr-6 w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-roameoSurface/60 transition">
                  <td className="py-4 pl-6 pr-3">
                    <p className="text-sm font-mono font-semibold text-slate-700">{inv.id.substring(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(inv.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </td>
                  <td className="py-4 px-3">
                    <p className="text-sm font-semibold text-slate-800">{inv.bookings?.booking_token ?? '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{inv.bookings?.guest_name ?? '—'}</p>
                  </td>
                  <td className="py-4 px-3 text-right">
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(inv.amount)}</span>
                  </td>
                  <td className="py-4 px-3 text-center">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        inv.status === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-4 pr-6">
                    <div className="flex items-center justify-end gap-2">
                      {inv.status !== 'Paid' && (
                        <button
                          onClick={() => handleMarkPaid(inv.id)}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition"
                          title="Mark as Paid"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setPrintInvoice(inv)}
                        className="p-1.5 rounded-lg hover:bg-roameoSurface text-slate-400 hover:text-roameoAccent transition"
                        title="View / Print"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showGenerate && (
        <GenerateModal
          bookings={bookings}
          onClose={() => setShowGenerate(false)}
          onSave={() => { setShowGenerate(false); fetchInvoices(); fetchBookings(); }}
          showToast={showToast}
        />
      )}

      {printInvoice && (
        <PrintInvoiceModal
          invoiceId={printInvoice.id}
          invoiceDate={printInvoice.created_at}
          invoiceStatus={printInvoice.status}
          onClose={() => setPrintInvoice(null)}
        />
      )}
    </div>
  );
};
