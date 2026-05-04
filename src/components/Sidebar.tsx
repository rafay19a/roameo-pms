import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BedDouble,
  CalendarCheck,
  FileText,
  Utensils,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/rooms',     icon: BedDouble,       label: 'Rooms' },
  { to: '/bookings',  icon: CalendarCheck,   label: 'Bookings' },
  { to: '/invoices',  icon: FileText,        label: 'Invoices' },
  { to: '/menu',      icon: Utensils,        label: 'Menu' },
  { to: '/users',     icon: Users,           label: 'Users' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
];

function getInitials(email?: string): string {
  if (!email) return 'U';
  return email.charAt(0).toUpperCase();
}

export const Sidebar: React.FC = () => {
  const { signOut, appUser } = useAuth();

  return (
    <div
      className="flex flex-col w-64 h-full flex-shrink-0"
      style={{
        background: 'linear-gradient(180deg, #6F8F97 0%, #4a6d75 55%, #3d5c63 100%)',
      }}
    >
      {/* ── Logo ─────────────────────────────────── */}
      <div
        className="px-5 pt-6 pb-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}
      >
        {/* White logo — transparent background brand asset */}
        <img
          src="/logo-white.png"
          alt="Roameo"
          className="h-30 w-auto max-w-[176px] object-contain opacity-95 transition-opacity duration-200 hover:opacity-100"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (fb) fb.style.display = 'flex';
          }}
        />
        {/* Text fallback if logo file is missing */}
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
            <p className="text-white/50 text-[9px] tracking-widest uppercase mt-0.5">Resorts &amp; Hotels</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────── */}
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
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
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

      {/* ── User + Sign Out ───────────────────────── */}
      <div
        className="px-3 py-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
      >
        {/* User info */}
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

        {/* Sign out */}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/65 rounded-xl transition-all duration-150 hover:bg-white/10 hover:text-white group"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0 text-white/50 group-hover:text-white/80 transition-colors duration-150" />
          Sign Out
        </button>
      </div>
    </div>
  );
};
