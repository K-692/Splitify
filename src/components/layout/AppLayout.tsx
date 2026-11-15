import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';
export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0D1B2A] text-slate-800 dark:text-slate-100 transition-colors">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-12">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};
