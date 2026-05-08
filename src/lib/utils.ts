import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateBookingToken() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ROA-${yyyy}${mm}${dd}-${random}`;
}

export function formatCurrency(amount: number) {
  return 'Rs ' + new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0,
  }).format(amount);
}
