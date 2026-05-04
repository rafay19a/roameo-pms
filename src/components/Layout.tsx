import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-roameoSurface overflow-hidden">

      {/* ── Sidebar ── */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Mobile backdrop ── */}
      <div
        className={[
          'fixed inset-0 z-30 bg-slate-900/50 md:hidden transition-opacity duration-300',
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Mobile top bar — hidden on md+ */}
        <header
          className="flex items-center gap-3 h-14 px-4 flex-shrink-0 md:hidden"
          style={{
            background: 'white',
            borderBottom: '1px solid #E2EEF0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          {/* Hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="h-10 w-10 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo — teal version on white topbar */}
          <img
            src="/roameo-logo.png"
            alt="Roameo"
            className="h-8 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (fb) fb.style.display = 'block';
            }}
          />
          <span
            className="hidden text-base font-bold tracking-[0.14em] text-roameoDark"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            ROAMEO
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden focus:outline-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-5 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
