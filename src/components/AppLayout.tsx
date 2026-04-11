import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Users, Sword, Settings, Menu, LogOut, Trophy, Globe, Activity, Shield, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { RoleGate } from './RoleGate';
import { useLeague } from '../context/LeagueContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NavItemProps {
  item: any;
  isCollapsed: boolean;
  isSubItem?: boolean;
  onNavigate?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ item, isCollapsed, isSubItem = false, onNavigate }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const navigate = useNavigate();
  const hasChildren = item.children && item.children.length > 0;

  const content = (
    <div className="relative group">
      <NavLink
        to={item.path}
        onClick={() => {
          if (onNavigate) onNavigate();
        }}
        className={({ isActive }) =>
          cn(
            'flex items-center space-x-3 rounded-xl px-4 py-3 text-sm font-bold transition-all relative',
            isActive && !hasChildren
              ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20'
              : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300',
            isCollapsed && 'justify-center px-0',
            isSubItem && 'py-2 pl-12 pr-4 text-xs'
          )
        }
      >
        <item.icon className={cn("h-5 w-5 shrink-0", isCollapsed && "mx-auto")} />
        {!isCollapsed && (
          <span className="flex-1 truncate">{item.label}</span>
        )}

        {/* Tooltip for Collapsed State */}
        {isCollapsed && isHovered && !hasChildren && (
          <div className="absolute left-full ml-4 z-50 px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg shadow-xl pointer-events-none whitespace-nowrap">
            <span className="text-xs font-black uppercase tracking-widest text-white">{item.label}</span>
          </div>
        )}
      </NavLink>

      {/* Separate Toggle for Expanded State */}
      {hasChildren && !isCollapsed && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/5 rounded-lg transition-colors"
        >
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-zinc-600" />
          </motion.div>
        </button>
      )}
    </div>
  );

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (isCollapsed) setIsOpen(false);
      }}
    >
      {item.label === 'Admin' ? (
        <RoleGate allowedRoles={['Owner', 'Commissioner']}>
          {content}
        </RoleGate>
      ) : content}

      {/* Accordion Sub-menu (Expanded) */}
      <AnimatePresence>
        {hasChildren && !isCollapsed && isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {item.children.map((child: any) => (
              <NavItem 
                key={child.path} 
                item={child} 
                isCollapsed={isCollapsed} 
                isSubItem={true} 
                onNavigate={onNavigate}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flyout Sub-menu (Collapsed) */}
      <AnimatePresence>
        {hasChildren && isCollapsed && isHovered && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute left-full top-0 ml-2 z-50 w-48 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-2"
          >
            <div className="px-4 py-2 border-b border-white/5 mb-1">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{item.label}</span>
            </div>
            {item.children.map((child: any) => (
              <NavLink
                key={child.path}
                to={child.path}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-3 rounded-xl px-4 py-2.5 text-xs font-bold transition-all',
                    isActive
                      ? 'bg-orange-600 text-white'
                      : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
                  )
                }
              >
                <child.icon className="h-4 w-4" />
                <span>{child.label}</span>
              </NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const { userTeam } = useLeague();
  const [isCollapsed, setIsCollapsed] = React.useState(window.innerWidth < 1280);

  React.useEffect(() => {
    const handleResize = () => {
      // Auto-collapse on smaller screens (tablets)
      if (window.innerWidth < 1280) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Shield, label: 'My Team', path: userTeam ? `/school/${userTeam.id}` : '/team' },
    { icon: Sword, label: 'Matchups', path: '/matchups' },
    { icon: Trophy, label: 'League', path: '/league' },
    { icon: Settings, label: 'Admin', path: '/admin' },
  ];

  const desktopNavItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Shield, label: 'My Team', path: userTeam ? `/school/${userTeam.id}` : '/team' },
    { icon: Sword, label: 'Matchups', path: '/matchups' },
    { 
      icon: Trophy, 
      label: 'League Hub', 
      path: '/league',
      children: [
        { icon: Activity, label: 'Standings', path: '/standings' },
        { icon: LayoutGrid, label: 'Leaders', path: '/leaders' },
      ]
    },
    { icon: Globe, label: 'Programs', path: '/programs' },
    { icon: Settings, label: 'Admin', path: '/admin' },
  ];

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
      <aside 
        className={cn(
          "hidden flex-col border-r border-zinc-900 bg-zinc-950 md:flex transition-all duration-300 ease-in-out relative",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className={cn("flex h-16 items-center border-b border-zinc-900 px-6", isCollapsed && "px-0 justify-center")}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-600/20 shrink-0">
              <Trophy size={16} className="text-white" />
            </div>
            {!isCollapsed && (
              <span className="text-lg font-black tracking-tight uppercase italic whitespace-nowrap">
                Dynasty <span className="text-orange-600">Hub</span>
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4 overflow-y-auto custom-scrollbar">
          {desktopNavItems.map((item) => (
            <NavItem 
              key={item.path} 
              item={item} 
              isCollapsed={isCollapsed} 
            />
          ))}
        </nav>

        <div className="border-t border-zinc-900 p-4 space-y-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "flex w-full items-center space-x-3 rounded-xl px-4 py-3 text-sm font-bold text-zinc-500 transition-all hover:bg-zinc-900 hover:text-zinc-300",
              isCollapsed && "justify-center px-0"
            )}
          >
            {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            {!isCollapsed && <span>Collapse Menu</span>}
          </button>

          <button
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center space-x-3 rounded-xl px-4 py-3 text-sm font-bold text-zinc-500 transition-all hover:bg-red-500/10 hover:text-red-500",
              isCollapsed && "justify-center px-0"
            )}
          >
            <LogOut className="h-5 w-5" />
            {!isCollapsed && <span>Sign Out</span>}
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

        <div className="mx-auto max-w-full px-4 md:px-8 lg:px-12">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-around border-t border-zinc-900 bg-zinc-950/90 backdrop-blur-xl px-2 md:hidden">
        {navItems.map((item) => {
          const link = (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center space-y-1 py-2 transition-all rounded-xl flex-1 min-w-0',
                  isActive ? 'text-orange-500 bg-orange-500/5' : 'text-zinc-500 hover:text-zinc-300'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[8px] font-black uppercase tracking-widest truncate w-full text-center">{item.label}</span>
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
    </div>
  );
};
