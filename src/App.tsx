import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Trophy, 
  Calendar, 
  Users, 
  BarChart3, 
  Award, 
  Settings, 
  Plus, 
  Upload,
  ChevronRight,
  Menu,
  X,
  LogOut,
  LogIn,
  School
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useLocation,
  useNavigate
} from 'react-router-dom';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import Papa from 'papaparse';

import { SidebarProvider, useSidebar } from './context/SidebarContext';
import { LeagueConfig } from './components/LeagueConfig';
import { Schools } from './components/Schools';
import { Schedules } from './components/Schedules';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, to, onClick }: { icon: any, label: string, to: string, onClick?: () => void }) => {
  const location = useLocation();
  const active = location.pathname === to;
  const { isOpen } = useSidebar();

  return (
    <Link 
      to={to} 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative ${
        active 
          ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/30' 
          : 'text-zinc-500 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon size={20} className={`shrink-0 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.span 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="font-bold text-sm whitespace-nowrap overflow-hidden tracking-tight"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      
      {!isOpen && (
        <div className="absolute left-full ml-4 px-3 py-2 bg-zinc-900 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-50 whitespace-nowrap shadow-2xl translate-x-[-10px] group-hover:translate-x-0">
          {label}
        </div>
      )}

      {active && isOpen && (
        <motion.div 
          layoutId="active-pill"
          className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] shrink-0"
        />
      )}
    </Link>
  );
};

const Navbar = ({ user }: { user: User | null }) => {
  const { toggle, isOpen } = useSidebar();
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  return (
    <nav className="h-16 glass-surface flex items-center justify-between px-4 sm:px-8 sticky top-0 z-50 border-b border-white/5">
      <div className="flex items-center gap-4 sm:gap-6">
        <button 
          onClick={toggle}
          className="p-2.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-300 active:scale-90"
          aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex items-center gap-3.5 group cursor-pointer">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center font-bold text-white italic shadow-lg shadow-orange-600/30 shrink-0 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500">
            CFB
          </div>
          <div className="flex flex-col">
            <span className="text-lg sm:text-xl font-display font-black tracking-tight text-white leading-none">
              THIS GAME <span className="text-orange-600">SUX</span>
            </span>
            <span className="text-[9px] uppercase tracking-[0.4em] text-zinc-500 font-bold hidden xs:block">Dynasty Tracker</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        {user ? (
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold text-white tracking-tight">{user.displayName}</p>
              <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest opacity-80">Dynasty Coach</p>
            </div>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-orange-600/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
              <img 
                src={user.photoURL || ''} 
                alt="Avatar" 
                className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/10 group-hover:border-orange-600/50 transition-all duration-300 object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-zinc-950 rounded-full" />
            </div>
            <button 
              onClick={handleLogout}
              className="p-2.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all duration-300 active:scale-90"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="group relative flex items-center gap-2.5 bg-white text-black px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-black hover:bg-zinc-100 transition-all text-xs sm:text-sm shadow-2xl shadow-white/10 active:scale-95 overflow-hidden"
          >
            <div className="absolute inset-0 bg-orange-600/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <LogIn size={18} className="relative z-10" />
            <span className="relative z-10">COACH LOGIN</span>
          </button>
        )}
      </div>
    </nav>
  );
};

// --- Pages ---

const Home = ({ user }: { user: User | null }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [leagueData, setLeagueData] = useState<{ id: string | null, currentYear: number, currentWeek: number, teamCount: number }>({ id: null, currentYear: 2024, currentWeek: 1, teamCount: 0 });
  const [isCreatingLeague, setIsCreatingLeague] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('This Game Sux');

  useEffect(() => {
    if (!user) return;

    // Fetch the first league for the user
    const leaguesQuery = query(collection(db, 'leagues'), where('ownerId', '==', user.uid), limit(1));
    const unsubscribe = onSnapshot(leaguesQuery, (snapshot) => {
      if (!snapshot.empty) {
        const leagueDoc = snapshot.docs[0];
        const data = leagueDoc.data();
        
        // Fetch team count
        const teamsQuery = collection(db, 'leagues', leagueDoc.id, 'teams');
        onSnapshot(teamsQuery, (teamSnapshot) => {
          setLeagueData({
            id: leagueDoc.id,
            currentYear: data.currentYear || 2024,
            currentWeek: data.currentWeek || 1,
            teamCount: teamSnapshot.size
          });
        });
      } else {
        setLeagueData({ id: null, currentYear: 2024, currentWeek: 1, teamCount: 0 });
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleUpdateWeek = async (newWeek: number) => {
    if (!leagueData.id) return;
    try {
      await updateDoc(doc(db, 'leagues', leagueData.id), { currentWeek: newWeek });
    } catch (err) {
      console.error("Error updating week:", err);
    }
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newLeagueName) return;
    setIsCreatingLeague(true);
    try {
      await addDoc(collection(db, 'leagues'), {
        name: newLeagueName,
        ownerId: user.uid,
        currentYear: 2024,
        currentWeek: 1,
        seasonPhase: 'Off Season',
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error creating league:", err);
    } finally {
      setIsCreatingLeague(false);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        console.log("Parsed CSV:", results.data);
        setTimeout(() => {
          setIsUploading(false);
          alert(`Successfully parsed ${results.data.length} rows of dynasty data!`);
        }, 1500);
      },
      error: (error) => {
        console.error("CSV Parse Error:", error);
        setIsUploading(false);
      }
    });
  };

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-orange-600 font-bold text-[10px] uppercase tracking-[0.3em]"
        >
          <Trophy size={14} />
          EA Sports College Football 26
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl sm:text-6xl font-display font-black text-white tracking-tight leading-none"
        >
          Dynasty <span className="text-orange-600 italic">Central</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-zinc-400 text-lg max-w-2xl font-medium"
        >
          Managing the legacy of the "{leagueData.id ? 'This Game Sux' : 'Your'}" Online Dynasty.
        </motion.p>
      </header>

      {!leagueData.id ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 sm:p-16 rounded-[2rem] text-center space-y-8"
        >
          <div className="w-20 h-20 bg-orange-600/10 rounded-3xl flex items-center justify-center mx-auto border border-orange-600/20 shadow-inner">
            <Plus className="text-orange-600" size={40} />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-display font-bold text-white">Initialize Your Dynasty</h2>
            <p className="text-zinc-500 max-w-md mx-auto text-lg">You haven't created a league yet. Start by naming your dynasty to unlock commissioner tools and stat tracking.</p>
          </div>
          <form onSubmit={handleCreateLeague} className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              value={newLeagueName}
              onChange={(e) => setNewLeagueName(e.target.value)}
              placeholder="League Name"
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-orange-600/50 transition-all duration-300 placeholder:text-zinc-600"
              required
            />
            <button 
              type="submit"
              disabled={isCreatingLeague}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-xl shadow-orange-600/20 disabled:opacity-50 active:scale-95"
            >
              {isCreatingLeague ? 'Creating...' : 'Create Dynasty'}
            </button>
          </form>
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Active Season', value: leagueData.currentYear, sub: `WEEK ${leagueData.currentWeek} • CUSTOM SCHEDULES ACTIVE`, icon: Calendar },
              { label: 'User Coaches', value: `${leagueData.teamCount} / 32`, sub: `ALL USERS ADVANCED TO WEEK ${leagueData.currentWeek}`, icon: Users },
              { label: 'Stat Records', value: '1,248', sub: 'SEASON OVER SEASON TRACKING', icon: BarChart3 },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 + 0.3 }}
                className="glass-card p-8 rounded-3xl space-y-4 relative overflow-hidden group"
              >
                <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                  <stat.icon size={120} />
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-zinc-500 font-bold text-xs uppercase tracking-widest">{stat.label}</h3>
                  <stat.icon className="text-orange-600/50" size={18} />
                </div>
                <p className="text-4xl font-display font-black text-white tracking-tight">{stat.value}</p>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">{stat.sub}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="glass-card rounded-3xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <h3 className="text-lg font-display font-bold text-white">Dynasty Activity</h3>
                <button className="text-[10px] text-orange-600 font-black uppercase tracking-widest hover:text-orange-500 transition-colors">History Log</button>
              </div>
              <div className="divide-y divide-white/5">
                {[
                  { type: 'Stat', detail: 'Week 7 Passing stats uploaded', time: '2h ago' },
                  { type: 'Recruit', detail: '5-star QB committed to Ohio State', time: '5h ago' },
                  { type: 'Game', detail: 'Michigan def. Michigan State 42-21', time: '1d ago' },
                  { type: 'Season', detail: 'Advanced to Week 8', time: '2d ago' },
                ].map((activity, i) => (
                  <div key={i} className="p-5 flex items-center gap-5 hover:bg-white/5 transition-all duration-300 group">
                    <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center border border-white/5 group-hover:border-orange-600/30 transition-colors">
                      <Upload size={20} className="text-zinc-500 group-hover:text-orange-600 transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-bold">{activity.type} Update</p>
                      <p className="text-xs text-zinc-500 font-medium">{activity.detail}</p>
                    </div>
                    <span className="ml-auto text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{activity.time}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="glass-card rounded-3xl p-8 space-y-8"
            >
              <div className="space-y-2">
                <h3 className="text-lg font-display font-bold text-white">Commissioner Tools</h3>
                <p className="text-xs text-zinc-500 font-medium">Quick actions for league management</p>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 p-5 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-600/20">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Current Week</p>
                      <p className="text-lg font-display font-bold text-white italic">Week {leagueData.currentWeek}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleUpdateWeek(Math.max(1, leagueData.currentWeek - 1))}
                      className="w-10 h-10 bg-zinc-950 border border-white/5 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                      -
                    </button>
                    <button 
                      onClick={() => handleUpdateWeek(leagueData.currentWeek + 1)}
                      className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex flex-col items-center justify-center gap-4 p-8 bg-white/5 hover:bg-orange-600/10 rounded-2xl transition-all border border-white/5 hover:border-orange-600/30 group"
                >
                  <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center border border-white/5 group-hover:bg-orange-600 group-hover:border-orange-600 transition-all duration-300">
                    <Plus className="text-orange-600 group-hover:text-white transition-colors" size={24} />
                  </div>
                  <span className="text-xs font-bold text-zinc-400 group-hover:text-white uppercase tracking-widest">Manual Entry</span>
                </button>
                
                <label className="flex flex-col items-center justify-center gap-4 p-8 bg-white/5 hover:bg-orange-600/10 rounded-2xl transition-all border border-white/5 hover:border-orange-600/30 group cursor-pointer">
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={handleCsvUpload}
                    disabled={isUploading}
                  />
                  <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center border border-white/5 group-hover:bg-orange-600 group-hover:border-orange-600 transition-all duration-300">
                    <Upload className={`text-orange-600 group-hover:text-white transition-colors ${isUploading ? 'animate-bounce' : ''}`} size={24} />
                  </div>
                  <span className="text-xs font-bold text-zinc-400 group-hover:text-white uppercase tracking-widest">
                    {isUploading ? 'Processing...' : 'Bulk Import'}
                  </span>
                </label>
              </div>
              <div className="p-5 bg-orange-600/5 border border-orange-600/10 rounded-2xl">
                <p className="text-xs text-orange-600/80 font-medium leading-relaxed">
                  <span className="font-black uppercase tracking-widest text-orange-600 mr-2">Pro Tip:</span> 
                  Export your dynasty stats to CSV from the EA Sports companion app or use OCR tools to capture screen data for bulk import.
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}

      {/* Add Stat Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
                <h3 className="text-xl font-bold text-white">Record Dynasty Stat</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <form className="p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); setIsAddModalOpen(false); }}>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Player Name / Team</label>
                  <input type="text" placeholder="e.g. Quinshon Judkins (Ohio State)" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-600 transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Category</label>
                    <select className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-600 transition-colors">
                      <option>Passing Yards</option>
                      <option>Rushing Yards</option>
                      <option>Receiving Yards</option>
                      <option>Tackles</option>
                      <option>Interceptions</option>
                      <option>Coach XP</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Value</label>
                    <input type="number" placeholder="0" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-600 transition-colors" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Season / Week</label>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" defaultValue="2024" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-600 transition-colors" />
                    <input type="text" defaultValue="Week 8" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-600 transition-colors" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20 mt-4">
                  Commit to History
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
      <Settings className="text-zinc-600 animate-spin-slow" size={32} />
    </div>
    <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
    <p className="text-zinc-500 max-w-xs text-center">This dynasty module is currently being calibrated for CFB 26 data structures.</p>
  </div>
);

// --- Main App ---

const AppContent = () => {
  const [user, setUser] = useState<User | null>(null);
  const { isOpen, toggle } = useSidebar();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-orange-600/30 overflow-x-hidden w-full">
      <Navbar user={user} />
      
      <div className="flex relative w-full">
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggle}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-16 h-[calc(100vh-64px)] bg-zinc-950 border-r border-zinc-800 transition-all duration-300 z-40
          ${isOpen ? 'w-64' : 'w-20'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-4 space-y-2">
            <SidebarItem icon={LayoutDashboard} label="Dashboard" to="/" onClick={() => window.innerWidth < 1024 && toggle()} />
            <SidebarItem icon={School} label="Schools" to="/schools" onClick={() => window.innerWidth < 1024 && toggle()} />
            <SidebarItem icon={BarChart3} label="Rankings" to="/rankings" onClick={() => window.innerWidth < 1024 && toggle()} />
            <SidebarItem icon={Calendar} label="Schedules" to="/schedules" onClick={() => window.innerWidth < 1024 && toggle()} />
            <SidebarItem icon={Trophy} label="Standings" to="/standings" onClick={() => window.innerWidth < 1024 && toggle()} />
            <SidebarItem icon={Users} label="Recruiting" to="/recruiting" onClick={() => window.innerWidth < 1024 && toggle()} />
            <SidebarItem icon={BarChart3} label="Stats" to="/stats" onClick={() => window.innerWidth < 1024 && toggle()} />
            <SidebarItem icon={Award} label="Awards" to="/awards" onClick={() => window.innerWidth < 1024 && toggle()} />
            <div className="pt-4 mt-4 border-t border-zinc-800">
              <SidebarItem icon={Settings} label="League Settings" to="/settings" onClick={() => window.innerWidth < 1024 && toggle()} />
            </div>
          </div>

          <div className="absolute bottom-4 left-4 right-4">
            <button 
              onClick={toggle}
              className="w-full flex items-center justify-center p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-white"
              aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isOpen ? <X size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/schools" element={<Schools user={user} />} />
            <Route path="/rankings" element={<PlaceholderPage title="Rankings" />} />
            <Route path="/schedules" element={<Schedules user={user} />} />
            <Route path="/standings" element={<PlaceholderPage title="Conference Standings" />} />
            <Route path="/recruiting" element={<PlaceholderPage title="Recruiting Classes" />} />
            <Route path="/stats" element={<PlaceholderPage title="Stats" />} />
            <Route path="/awards" element={<PlaceholderPage title="Award History" />} />
            <Route path="/settings" element={<LeagueConfig user={user} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <SidebarProvider>
        <AppContent />
      </SidebarProvider>
    </Router>
  );
}
