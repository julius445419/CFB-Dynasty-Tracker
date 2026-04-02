import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, LayoutGrid, BarChart3, Settings, Shield, Loader2, Sparkles, ChevronRight, Calendar, ArrowLeft } from 'lucide-react';
import { useLeague } from '../context/LeagueContext';
import { getTeamLogo, getTeamColor } from '../utils/teamAssets';
import { RosterList } from '../components/roster/RosterList';
import { MyBoard } from './MyBoard';
import { useNavigate, useParams } from 'react-router-dom';
import AddMatchupModal from '../components/modals/AddMatchupModal';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

type Tab = 'Roster' | 'Depth Chart' | 'Stats' | 'Recruiting';

export const MyTeam: React.FC = () => {
  const { user } = useAuth();
  const { userTeam: currentUserTeam, loading: leagueLoading, leagueInfo, currentLeagueId } = useLeague();
  const { teamId } = useParams<{ teamId: string }>();
  const [targetTeam, setTargetTeam] = useState<any>(null);
  const [loading, setLoading] = useState(!!teamId);
  const [activeTab, setActiveTab] = useState<Tab>('Roster');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const navigate = useNavigate();

  const isReadOnly = teamId ? targetTeam?.ownerId !== user?.uid : false;

  useEffect(() => {
    if (!teamId) {
      setTargetTeam(currentUserTeam);
      setLoading(false);
      return;
    }

    const fetchTeam = async () => {
      if (!currentLeagueId) return;
      setLoading(true);
      try {
        const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', teamId);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
          setTargetTeam({ id: teamSnap.id, ...teamSnap.data() });
        } else {
          // If teamId is a school name (fallback from NationalHub)
          setTargetTeam({ school: teamId, role: 'CPU', isPlaceholder: false });
        }
      } catch (error) {
        console.error('Error fetching team:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [teamId, currentUserTeam, currentLeagueId]);

  if (leagueLoading || loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Loading Team Hub...</p>
        </div>
      </div>
    );
  }

  if (!targetTeam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-24 h-24 bg-orange-600/10 border border-orange-600/20 rounded-[32px] flex items-center justify-center mb-8 relative"
        >
          <Trophy size={48} className="text-orange-500" />
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-1 -right-1"
          >
            <Sparkles size={24} className="text-orange-400" />
          </motion.div>
        </motion.div>
        
        <h2 className="text-3xl font-black mb-3 uppercase tracking-tight">Welcome to the Dynasty</h2>
        <p className="text-zinc-500 text-sm max-w-xs leading-relaxed mb-10">
          You are currently a member of <span className="text-white font-bold">{leagueInfo?.name}</span>, but you haven't claimed a school yet.
        </p>

        <div className="w-full max-w-sm space-y-4">
          <button 
            onClick={() => navigate('/request-team')}
            className="w-full bg-white text-black font-black py-5 rounded-2xl hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-xl shadow-white/5"
          >
            REQUEST TO JOIN A SCHOOL
            <ChevronRight size={20} />
          </button>
          
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
            Waiting for Commissioner Assignment?
          </p>
        </div>
      </div>
    );
  }

  const logoUrl = getTeamLogo(targetTeam.school || targetTeam.name);
  const teamColor = getTeamColor(targetTeam.school || targetTeam.name);

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-orange-600/30">
      {/* Header Section */}
      <header className="px-6 pt-12 pb-8 max-w-2xl mx-auto">
        {teamId && (
          <button 
            onClick={() => navigate(-1)}
            className="mb-8 flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <ArrowLeft size={14} />
            Back to Directory
          </button>
        )}
        <div className="flex items-center gap-6">
          <div className="relative">
            <div 
              className="absolute inset-0 blur-2xl opacity-20 rounded-full"
              style={{ backgroundColor: teamColor }}
            />
            <div className="relative w-24 h-24 bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-3xl flex items-center justify-center p-4">
              <img 
                src={logoUrl} 
                alt={targetTeam.school || targetTeam.name} 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">{targetTeam.school || targetTeam.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="px-2 py-0.5 bg-orange-600 text-white text-[10px] font-black rounded uppercase tracking-widest">
                {targetTeam.role || targetTeam.coachRole}
              </span>
              {(targetTeam.coachName) && (
                <span className="text-zinc-300 text-xs font-black uppercase italic tracking-tight">
                  Coach {targetTeam.coachName}
                </span>
              )}
              <span className="text-zinc-500 text-sm font-bold">0-0 RECORD</span>
            </div>
            {!isReadOnly && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-4 flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-black px-4 py-2 rounded-xl border border-zinc-800 transition-all uppercase tracking-widest"
              >
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                Schedule Next Game
              </button>
            )}
          </div>
        </div>

        {/* Tabs Section */}
        <div className="mt-10 relative">
          <div className="flex items-center gap-8 border-b border-zinc-800 pb-4 overflow-x-auto no-scrollbar">
            {(['Roster', 'Depth Chart', 'Stats', 'Recruiting'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap ${
                  activeTab === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -bottom-[17px] left-0 right-0 h-1 bg-orange-600 rounded-full z-10 shadow-lg shadow-orange-600/50"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'Roster' && (
            <motion.div
              key="roster"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <RosterList />
            </motion.div>
          )}
          {activeTab === 'Recruiting' && (
            <motion.div
              key="recruiting"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <MyBoard teamId={targetTeam.id} />
            </motion.div>
          )}
          {activeTab !== 'Roster' && activeTab !== 'Recruiting' && (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-6">
                <LayoutGrid size={24} className="text-zinc-700" />
              </div>
              <h3 className="text-zinc-500 font-bold uppercase tracking-widest text-xs">
                {activeTab} Module Calibrating...
              </h3>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AddMatchupModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        prefillHomeTeam={targetTeam.school || targetTeam.name}
      />
    </div>
  );
};
