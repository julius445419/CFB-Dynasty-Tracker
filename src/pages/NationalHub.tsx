import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, Trophy, Users, Ghost, Loader2, ChevronUp, X, School as SchoolIcon } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useLeague } from '../context/LeagueContext';
import { SCHOOLS } from '../constants/schools';
import { SchoolCard } from '../components/SchoolCard';
import { useNavigate } from 'react-router-dom';

export const NationalHub: React.FC = () => {
  const { currentLeagueId, loading: leagueLoading } = useLeague();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConference, setSelectedConference] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const conferences = useMemo(() => {
    const confs = Array.from(new Set(SCHOOLS.map(s => s.conference)));
    return confs.sort();
  }, []);

  useEffect(() => {
    if (!currentLeagueId) return;

    const fetchTeams = async () => {
      setLoading(true);
      try {
        const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
        const teamsSnap = await getDocs(teamsRef);
        const teamsData = teamsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTeams(teamsData);
      } catch (error) {
        console.error('Error fetching teams:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [currentLeagueId]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const filteredSchools = useMemo(() => {
    return SCHOOLS.filter(school => {
      const matchesSearch = school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           school.conference.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesConference = !selectedConference || school.conference === selectedConference;
      return matchesSearch && matchesConference;
    });
  }, [searchQuery, selectedConference]);

  const getCoachForSchool = (schoolName: string) => {
    return teams.find(t => (t.school || t.name) === schoolName);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (leagueLoading || loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Scanning National Landscape...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center border border-orange-600/20">
                <SchoolIcon className="text-orange-500" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase italic tracking-tight">National <span className="text-orange-600">Hub</span></h1>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">School Directory</p>
              </div>
            </div>
            <button
              onClick={() => setIsFilterOpen(true)}
              className={`p-3 rounded-xl border transition-all ${
                selectedConference 
                  ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <Filter size={20} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Search Schools or Conferences..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 bg-zinc-800 rounded-full text-zinc-400"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-8">
        {selectedConference && (
          <div className="flex items-center gap-2 mb-6">
            <span className="px-3 py-1 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-2">
              {selectedConference}
              <button onClick={() => setSelectedConference(null)}><X size={12} /></button>
            </span>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
              {filteredSchools.length} Schools Found
            </p>
          </div>
        )}

        <motion.div 
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredSchools.map((school) => {
              const coach = getCoachForSchool(school.name);
              return (
                <SchoolCard
                  key={school.name}
                  school={school}
                  coach={coach}
                  onClick={() => navigate(`/teams/${coach?.id || school.name}`)}
                />
              );
            })}
          </AnimatePresence>
        </motion.div>

        {filteredSchools.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-6">
              <Search size={24} className="text-zinc-700" />
            </div>
            <h3 className="text-zinc-500 font-bold uppercase tracking-widest text-xs">
              No schools matching your search
            </h3>
          </div>
        )}
      </main>

      {/* Conference Filter Modal */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed inset-x-0 bottom-0 z-50 bg-zinc-900 rounded-t-[32px] border-t border-zinc-800 p-6 pb-24 sm:max-w-lg sm:mx-auto max-h-[92vh] overflow-y-auto custom-scrollbar"
            >
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-white uppercase italic">Filter <span className="text-orange-600">Conference</span></h2>
                <button onClick={() => setIsFilterOpen(false)} className="p-2 bg-zinc-800 rounded-full text-zinc-400">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {conferences.map(conf => (
                  <button
                    key={conf}
                    onClick={() => {
                      setSelectedConference(conf === selectedConference ? null : conf);
                      setIsFilterOpen(false);
                    }}
                    className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border text-center ${
                      selectedConference === conf
                        ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {conf}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={scrollToTop}
            className="fixed bottom-24 right-6 z-40 p-4 bg-orange-600 text-white rounded-2xl shadow-2xl shadow-orange-600/40 hover:bg-orange-700 transition-all active:scale-95"
          >
            <ChevronUp size={24} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
