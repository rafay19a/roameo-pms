import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Star, X } from 'lucide-react';

type FeedbackType = 'completed' | 'cancelled';

const CANCELLATION_REASONS = [
  'Pricing issue',
  'Travel plan change',
  'No availability',
  'Other',
];

const FIELD = 'w-full px-3.5 py-2.5 text-sm text-slate-800 bg-roameoSurface border border-roameoBorder rounded-xl outline-none transition-all focus:bg-white focus:border-roameoPrimary focus:ring-2 focus:ring-roameoPrimary/20 resize-none';
const TEAL_BTN: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6F8F97 0%, #4F6F76 100%)',
};

interface FeedbackModalProps {
  bookingId: string;
  type: FeedbackType;
  guestName: string;
  onSubmit: () => void;
  onSkip: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  bookingId, type, guestName, onSubmit, onSkip,
}) => {
  const [rating, setRating]           = useState(0);
  const [hovered, setHovered]         = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [issues, setIssues]           = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelNote, setCancelNote]   = useState('');
  const [saving, setSaving]           = useState(false);

  const handleSubmit = async () => {
    setSaving(true);

    const payload = {
      booking_id: bookingId,
      type,
      rating:              type === 'completed' ? (rating || null) : null,
      feedback_text:       type === 'completed' ? (feedbackText.trim() || null) : (cancelNote.trim() || null),
      issues:              type === 'completed' ? (issues.trim() || null) : null,
      cancellation_reason: type === 'cancelled' ? (cancelReason || null) : null,
    };

    console.log('[FeedbackModal] INSERT payload:', payload);

    // Supabase JS v2 never throws — it returns { data, error }
    const { data, error } = await supabase.from('booking_feedback').insert([payload]).select();
    if (error) {
      console.error('[FeedbackModal] INSERT FAILED:', error);
    } else {
      console.log('[FeedbackModal] INSERT OK:', data);
    }

    setSaving(false);
    onSubmit();
  };

  const canSubmit = type === 'cancelled' ? !!cancelReason : true;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.60)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
        style={{ border: '1px solid rgba(212,230,234,0.9)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-6 pb-5"
          style={{ borderBottom: '1px solid #F1F5F9' }}
        >
          <div>
            <h3 className="text-[17px] font-bold text-slate-800 tracking-tight">
              {type === 'completed' ? 'Rate the Stay' : 'Cancellation Reason'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{guestName}</p>
          </div>
          <button
            onClick={onSkip}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {type === 'completed' ? (
            <>
              {/* Star rating */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Rating
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHovered(n)}
                      onMouseLeave={() => setHovered(0)}
                      className="transition-transform hover:scale-110 active:scale-95 p-0.5"
                    >
                      <Star
                        className="h-8 w-8 transition-colors"
                        style={{
                          color: n <= (hovered || rating) ? '#F59E0B' : '#CBD5E1',
                          fill:  n <= (hovered || rating) ? '#F59E0B' : 'transparent',
                        }}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-2 self-center text-sm font-semibold text-amber-600">
                      {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][rating]}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  How was the stay?
                </label>
                <textarea
                  rows={3}
                  className={FIELD}
                  placeholder="Share your experience…"
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Any issues faced?
                </label>
                <textarea
                  rows={2}
                  className={FIELD}
                  placeholder="Cleanliness, service, noise, etc. (optional)"
                  value={issues}
                  onChange={e => setIssues(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Reason *
                </label>
                <select
                  className={FIELD}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                >
                  <option value="">Select a reason…</option>
                  {CANCELLATION_REASONS.map(r => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Additional notes
                </label>
                <textarea
                  rows={3}
                  className={FIELD}
                  placeholder="Any additional details… (optional)"
                  value={cancelNote}
                  onChange={e => setCancelNote(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onSkip}
              className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !canSubmit}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
              style={TEAL_BTN}
            >
              {saving ? 'Saving…' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
