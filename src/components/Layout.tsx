import React from 'react';
import { Sidebar } from './Sidebar';
import { Outlet } from 'react-router-dom';

export const Layout: React.FC = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-roameoSurface">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto focus:outline-none">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
