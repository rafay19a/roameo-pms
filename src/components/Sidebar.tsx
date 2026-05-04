import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BedDouble,
  CalendarCheck,
  FileText,
  Utensils,
  Users,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/rooms',    icon: BedDouble,       label: 'Rooms' },
  { to: '/bookings', icon: CalendarCheck,   label: 'Bookings' },
  { to: '/invoices', icon: FileText,        label: 'Invoices' },
  { to: '/menu',     icon: Utensils,        label: 'Menu' },
  { to: '/users',    icon: Users,           label: 'Users' },
  { to: '/settings', icon: Settings,        label: 'Settings' },
];

function getInitials(email?: string): string {
  if (!email) return 'U';
  return email.charAt(0).toUpperCase();
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const { signOut, appUser } = useAuth();
  const location = useLocation();

  // Close sidebar whenever the route changes (after a nav tap on mobile)
  useEffect(() => {
    onClose();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside
      className={[
        // ── positioning ──────────────────────────────────────────────────
        // Mobile: fixed overlay that slides in from the left
        // Desktop (md+): static flex child, always visible
        'fixed inset-y-0 left-0 z-40',
        'md:static md:z-auto md:translate-x-0',

        // ── slide animation (mobile only) ────────────────────────────────
        'transition-transform duration-300 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full',

        // ── dimensions & layout ──────────────────────────────────────────
        'flex flex-col w-64 h-full flex-shrink-0',
      ].join(' ')}
      style={{
        background: 'linear-gradient(180deg, #6F8F97 0%, #4a6d75 55%, #3d5c63 100%)',
      }}
    >
      {/* ── Logo + mobile close ────────────────────────────────────────── */}
      <div
        className="flex items-start justify-between px-5 pt-6 pb-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}
      >
        {/* White logo */}
        <div className="flex-1 min-w-0">
          <img
            src="/logo-white.png"
            alt="Roameo"
            className="h-10 w-auto max-w-[160px] object-contain opacity-95 transition-opacity duration-200 hover:opacity-100"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (fb) fb.style.display = 'flex';
            }}
          />
          {/* Text fallback */}
          <div style={{ display: 'none' }} className="items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">R</span>
            </div>
            <div>
              <span
                className="text-white font-bold tracking-[0.16em] text-[15px] leading-none"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                ROAMEO
              </span>
              <p className="text-white/50 text-[9px] tracking-widest uppercase mt-0.5">
                Resorts &amp; Hotels
              </p>
            </div>
          </div>
        </div>

        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden flex-shrink-0 ml-2 h-8 w-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 active:bg-white/20 transition-colors"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 pt-5 pb-4 space-y-0.5">
        {navItems.map((item) => {
          if (item.to === '/users' && appUser?.role !== 'admin') return null;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'group flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  // 44px min touch target on mobile (py-3 = 12px × 2 + ~20px line = ~44px)
                  isActive
                    ? 'bg-white/16 text-white shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={[
                      'h-[18px] w-[18px] flex-shrink-0 transition-colors duration-150',
                      isActive ? 'text-white' : 'text-white/60 group-hover:text-white/90',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── User info + Sign out ────────────────────────────────────────── */}
      <div
        className="px-3 py-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
      >
        {/* Avatar + email + role */}
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">
              {getInitials(appUser?.email)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate leading-tight">
              {appUser?.email}
            </p>
            <p className="text-xs text-white/55 capitalize mt-0.5">{appUser?.role}</p>
          </div>
        </div>

        {/* Sign out — 44px tap target on mobile */}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-3 py-3 md:py-2.5 text-sm font-medium text-white/65 rounded-xl transition-all duration-150 hover:bg-white/10 hover:text-white active:bg-white/20 group"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0 text-white/50 group-hover:text-white/80 transition-colors duration-150" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
