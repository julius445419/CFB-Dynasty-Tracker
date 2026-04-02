import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Users, Sword, Settings, Menu, LogOut, Trophy, Globe, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { RoleGate } from './RoleGate';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Globe, label: 'Directory', path: '/national-hub' },
  { icon: Trophy, label: 'Standings', path: '/standings' },
  { icon: Activity, label: 'Leaders', path: '/leaders' },
  { icon: Users, label: 'My Team', path: '/team' },
  { icon: Sword, label: 'Matchups', path: '/matchups' },
  { icon: Settings, label: 'Admin', path: '/admin' },
];

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-zinc-950 md:flex-row text-white">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-zinc-900 bg-zinc-950 md:flex">
        <div className="flex h-16 items-center border-b border-zinc-900 px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-600/20">
              <Trophy size={16} className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tight uppercase italic">Dynasty <span className="text-orange-600">Hub</span></span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const link = (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-bold transition-all',
                    isActive
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
                      : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            );

            if (item.label === 'Admin') {
              return (
                <RoleGate key={item.path} allowedRoles={['Owner', 'Commissioner']}>
                  {link}
                </RoleGate>
              );
            }

            return link;
          })}
        </nav>
        <div className="border-t border-zinc-900 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center space-x-3 rounded-xl px-4 py-3 text-sm font-bold text-zinc-500 transition-all hover:bg-red-500/10 hover:text-red-500"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="relative flex-1 overflow-y-auto pb-24 md:pb-0">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-900 bg-zinc-950/80 px-6 backdrop-blur-md md:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-600/20">
              <Trophy size={16} className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tight uppercase italic">Dynasty <span className="text-orange-600">Hub</span></span>
          </div>
          <button 
            onClick={handleLogout}
            className="rounded-xl p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            <LogOut className="h-6 w-6" />
          </button>
        </header>

        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-start overflow-x-auto no-scrollbar border-t border-zinc-900 bg-zinc-950/90 backdrop-blur-xl px-4 md:hidden">
        <div className="flex items-center gap-1 min-w-full">
          {navItems.map((item) => {
            const link = (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center space-y-1 px-5 py-2 transition-all rounded-xl flex-shrink-0 min-w-[72px]',
                    isActive ? 'text-orange-500 bg-orange-500/5' : 'text-zinc-500 hover:text-zinc-300'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
              </NavLink>
            );

            if (item.label === 'Admin') {
              return (
                <RoleGate key={item.path} allowedRoles={['Owner', 'Commissioner']}>
                  {link}
                </RoleGate>
              );
            }

            return link;
          })}
        </div>
      </nav>
    </div>
  );
};
