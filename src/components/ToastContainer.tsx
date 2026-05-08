import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import type { ToastItem } from '../hooks/useToast';

export const ToastContainer: React.FC<{ toasts: ToastItem[] }> = ({ toasts }) => {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white animate-fade-in ${
            t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {t.type === 'success'
            ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
            : <XCircle className="h-4 w-4 flex-shrink-0" />}
          {t.message}
        </div>
      ))}
    </div>
  );
};
