import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, generateBookingToken } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './ToastContainer';
import {
  X, Upload, CheckCircle2, MessageCircle, AlertTriangle,
  User, Phone, BedDouble, Calendar, Hash,
} from 'lucide-react';

// ─── Shared interface (import this wherever you build a receipt) ──────────────

export interface ReceiptBooking {
  id: string;
  booking_token: string;
  confirmed_token?: string | null;
  guest_name: string;
  guest_phone?: string | null;
  room_id: string;
  room_number: string;
  room_type: string;
  price_per_night: number;
  check_in: string;
  check_out: string;
  total_price: number;
  advance_amount?: number | null;
  status: string;
  payment_proof_url?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function diffDays(a: string, b: string) {
  return Math.round(
    (new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime()) / 86400000,
  );
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-PK', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Dash = () => (
  <div className="my-4 mx-0" style={{ borderTop: '1px dashed #D4E6EA' }} />
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-roameoMuted mb-3">
    {children}
  </p>
);

const Row: React.FC<{ label: string; value: React.ReactNode; large?: boolean }> = ({
  label, value, large,
}) => (
  <div className="flex items-baseline justify-between py-1.5">
    <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
    <span className={`text-right ml-4 ${large ? 'text-sm font-bold text-slate-900' : 'text-xs font-medium text-slate-700'}`}>
      {value}
    </span>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    'Pending':    'bg-amber-50  text-amber-700  border border-amber-200',
    'Confirmed':  'bg-emerald-50 text-emerald-700 border border-emerald-200',
    'Checked-in': 'bg-blue-50   text-blue-700   border border-blue-200',
    'Completed':  'bg-slate-100 text-slate-600  border border-slate-200',
    'Cancelled':  'bg-red-50    text-red-600    border border-red-200',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${map[status] ?? map['Pending']}`}>
      {status}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface BookingConfirmationCardProps {
  booking: ReceiptBooking;
  onClose: () => void;
  onStatusChange?: (bookingId: string, newStatus: string, confirmedToken?: string) => void;
}

interface BookingItem {
  quantity: number;
  price: number;
  menu_items: { name: string } | null;
}

export const BookingConfirmationCard: React.FC<BookingConfirmationCardProps> = ({
  booking: initialBooking,
  onClose,
  onStatusChange,
}) => {
  const [bk, setBk] = useState<ReceiptBooking>(initialBooking);
  const [bookingItems, setBookingItems] = useState<BookingItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toasts, showToast } = useToast();

  useEffect(() => {
    supabase
      .from('booking_items')
      .select('quantity, price, menu_items:menu_item_id (name)')
      .eq('booking_id', bk.id)
      .then(({ data }) => setBookingItems((data as unknown as BookingItem[]) ?? []));
  }, [bk.id]);

  const nights   = diffDays(bk.check_in, bk.check_out);
  const advance  = bk.advance_amount ?? bk.total_price * 0.2;
  const isPending    = bk.status === 'Pending';
  const isConfirmed  = bk.status === 'Confirmed' || bk.status === 'Checked-in' || bk.status === 'Completed';
  const displayToken = bk.confirmed_token ?? bk.booking_token;

  // ── Upload payment proof ───────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `${bk.id}/proof.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('payment-proofs')
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(path);

      const { error: dbErr } = await supabase
        .from('bookings')
        .update({ payment_proof_url: urlData.publicUrl })
        .eq('id', bk.id);

      if (dbErr) throw dbErr;

      setBk(prev => ({ ...prev, payment_proof_url: urlData.publicUrl }));
      showToast('Payment proof uploaded');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      // Reset file input so same file can be re-selected
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Confirm booking ────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!bk.payment_proof_url) return;
    setConfirming(true);
    try {
      const finalToken = generateBookingToken();

      const { error } = await supabase
        .from('bookings')
        .update({ status: 'Confirmed', confirmed_token: finalToken })
        .eq('id', bk.id);

      if (error) throw error;

      setBk(prev => ({ ...prev, status: 'Confirmed', confirmed_token: finalToken }));
      onStatusChange?.(bk.id, 'Confirmed', finalToken);
      showToast('Booking confirmed!');
    } catch (err: any) {
      showToast(err.message || 'Confirmation failed', 'error');
    } finally {
      setConfirming(false);
    }
  };

  // ── WhatsApp share ─────────────────────────────────────────────────────────
  const handleWhatsApp = () => {
    const lines = [
      isConfirmed ? '*Booking Confirmed ✅*' : '*Booking Request 📋*',
      '',
      `Token: ${displayToken}`,
      `Name: ${bk.guest_name}`,
      bk.guest_phone ? `Phone: ${bk.guest_phone}` : null,
      `Room: ${bk.room_number} (${bk.room_type})`,
      `Check-in: ${fmtDate(bk.check_in)}`,
      `Check-out: ${fmtDate(bk.check_out)}`,
      `Nights: ${nights}`,
      `Total: ${formatCurrency(bk.total_price)}`,
      !isConfirmed ? `Advance (20%): ${formatCurrency(advance)}` : null,
      '',
      '_Roameo Resorts & Hotels_',
    ].filter(l => l !== null).join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl my-4"
        style={{ border: '1px solid rgba(212,230,234,0.7)' }}
      >
        {/* ── HEADER ── */}
        <div
          className="rounded-t-2xl px-6 pt-6 pb-5 relative"
          style={{ background: 'linear-gradient(135deg, #6F8F97 0%, #4a6d75 55%, #3d5c63 100%)' }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Logo row */}
          <div className="flex items-start justify-between pr-10">
            <div>
              <img
                src="/logo-white.png"
                alt="Roameo"
                className="h-8 w-auto object-contain"
                onError={e => {
                  e.currentTarget.style.display = 'none';
                  const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fb) fb.style.display = 'block';
                }}
              />
              <p
                className="hidden text-white font-bold text-base tracking-[0.16em]"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                ROAMEO
              </p>
              <p className="text-white/60 text-[9px] tracking-[0.22em] uppercase mt-0.5">
                Resorts &amp; Hotels
              </p>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-[9px] uppercase tracking-wider">Token</p>
              <p className="text-white font-mono font-bold text-xs mt-0.5 leading-snug break-all">
                {displayToken}
              </p>
            </div>
          </div>

          {/* Title */}
          <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}>
            <h2 className="text-white font-bold text-base tracking-[0.12em] uppercase">
              Booking Confirmation
            </h2>
            <p className="text-white/55 text-[10px] mt-0.5">
              {new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="px-6 py-5">

          {/* ── GUEST DETAILS ── */}
          <SectionLabel>Guest Details</SectionLabel>
          <div className="space-y-0">
            <Row
              label={<span className="flex items-center gap-1.5"><User className="h-3 w-3" /> Name</span> as any}
              value={bk.guest_name}
            />
            {bk.guest_phone && (
              <Row
                label={<span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> Phone</span> as any}
                value={bk.guest_phone}
              />
            )}
          </div>

          <Dash />

          {/* ── STAY DETAILS ── */}
          <SectionLabel>Stay Details</SectionLabel>
          <div className="space-y-0">
            <Row
              label={<span className="flex items-center gap-1.5"><Hash className="h-3 w-3" /> Booking ID</span> as any}
              value={<span className="font-mono text-[11px]">{bk.booking_token}</span>}
            />
            <Row
              label={<span className="flex items-center gap-1.5"><BedDouble className="h-3 w-3" /> Room</span> as any}
              value={`${bk.room_number} — ${bk.room_type}`}
            />
            <Row
              label={<span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Check-in</span> as any}
              value={fmtDate(bk.check_in)}
            />
            <Row
              label={<span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Check-out</span> as any}
              value={fmtDate(bk.check_out)}
            />
            <Row label="Duration" value={`${nights} night${nights !== 1 ? 's' : ''}`} />
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-slate-500">Status</span>
              <StatusBadge status={bk.status} />
            </div>
          </div>

          <Dash />

          {/* ── PRICING ── */}
          <SectionLabel>Pricing</SectionLabel>
          <div className="space-y-0">
            <Row label="Rate / night" value={formatCurrency(bk.price_per_night)} />
            <Row label="Nights" value={`× ${nights}`} />
            <Row label="Room charge" value={formatCurrency(bk.price_per_night * nights)} />
          </div>
          {bookingItems.length > 0 && (
            <>
              <div className="my-2" style={{ borderTop: '1px dashed #E2EEF0' }} />
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-roameoMuted mb-2">Room Service</p>
              <div className="space-y-0">
                {bookingItems.map((item, idx) => (
                  <Row
                    key={idx}
                    label={`${item.menu_items?.name ?? 'Item'} × ${item.quantity}`}
                    value={formatCurrency(item.price * item.quantity)}
                  />
                ))}
              </div>
            </>
          )}
          {/* Total divider */}
          <div className="my-2" style={{ borderTop: '1px solid #E2EEF0' }} />
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">Grand Total</span>
            <span className="text-base font-bold text-roameoDark">{formatCurrency(bk.total_price)}</span>
          </div>

          <Dash />

          {/* ── PAYMENT SECTION ── */}
          {isPending ? (
            <div>
              <SectionLabel>Payment Required</SectionLabel>
              <div
                className="rounded-xl p-4 mb-4"
                style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 leading-snug">
                      To confirm your booking, please pay the 20% advance.
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-amber-700">Advance Amount</span>
                      <span className="text-sm font-bold text-amber-900">
                        {formatCurrency(advance)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload proof */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleUpload}
              />

              {bk.payment_proof_url ? (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 mb-3">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-semibold">Payment proof uploaded</span>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="ml-auto text-[11px] underline text-emerald-600"
                  >
                    Replace
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl border-2 border-dashed border-roameoBorder text-roameoAccent hover:bg-roameoLight hover:border-roameoPrimary transition-all mb-3 disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading…' : 'Upload Payment Proof'}
                </button>
              )}

              {/* Confirm button */}
              <button
                onClick={handleConfirm}
                disabled={!bk.payment_proof_url || confirming}
                className="w-full py-3 text-sm font-bold text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)',
                  boxShadow: bk.payment_proof_url ? '0 4px 14px rgba(79,111,118,0.35)' : 'none',
                }}
              >
                {confirming ? 'Confirming…' : 'Confirm Booking'}
              </button>
            </div>
          ) : isConfirmed ? (
            <div
              className="rounded-xl p-4"
              style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">Booking Confirmed</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Thank you for your booking. Your reservation has been confirmed.
                  </p>
                  {bk.confirmed_token && (
                    <p className="text-[11px] text-emerald-600 mt-2">
                      Confirmation Token:{' '}
                      <span className="font-mono font-bold">{bk.confirmed_token}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <Dash />

          {/* ── ACTIONS ── */}
          <div className="flex gap-3">
            <button
              onClick={handleWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98]"
              style={{ background: '#25D366', boxShadow: '0 4px 12px rgba(37,211,102,0.30)' }}
            >
              <MessageCircle className="h-4 w-4" />
              Share via WhatsApp
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
};
