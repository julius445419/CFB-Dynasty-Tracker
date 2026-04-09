import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, Trophy, Users, Ghost, Loader2, ChevronUp, X, School as SchoolIcon, List, LayoutGrid, Square } from 'lucide-react';
import { collection, getDocs, query, where, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useLeague } from '../context/LeagueContext';
import { SCHOOLS } from '../constants/schools';
import { SchoolCard } from '../components/SchoolCard';
import { TeamLogo } from '../components/common/TeamLogo';
import { useNavigate } from 'react-router-dom';
import { CarouselCoach, TeamAssignment } from '../types';

type ViewMode = 'list' | 'compact' | 'large';

export const Programs: React.FC = () => {
  const { currentLeagueId, loading: leagueLoading } = useLeague();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConference, setSelectedConference] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [teams, setTeams] = useState<TeamAssignment[]>([]);
  const [coaches, setCoaches] = useState<CarouselCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const conferences = useMemo(() => {
    const confs = Array.from(new Set(SCHOOLS.map(s => s.conference)));
    return confs.sort();
  }, []);

  useEffect(() => {
    if (!currentLeagueId) return;

    const fetchTeamsAndCoaches = async () => {
      setLoading(true);
      try {
        // Fetch Teams
        const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
        const teamsSnap = await getDocs(teamsRef);
        const teamsData = teamsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TeamAssignment[];
        setTeams(teamsData);

        // Fetch Coaches
        const coachesRef = collection(db, 'coaches');
        const coachesQuery = query(coachesRef, where('leagueId', '==', currentLeagueId));
        const coachesSnap = await getDocs(coachesQuery);
        const coachesData = coachesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CarouselCoach[];
        setCoaches(coachesData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamsAndCoaches();
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
    const team = teams.find(t => t.name === schoolName);
    if (!team) return null;

    // If team has a relational head coach, use that
    if (team.headCoachId) {
      const coach = coaches.find(c => c.id === team.headCoachId);
      if (coach) {
        return {
          coachName: coach.name,
          ownerId: team.ownerId,
          isPlaceholder: team.isPlaceholder,
          teamId: team.id,
          wins: team.wins || 0,
          losses: team.losses || 0,
          currentRank: team.currentRank
        };
      }
    }

    // Fallback to embedded coachName
    return {
      ...team,
      teamId: team.id,
      wins: team.wins || 0,
      losses: team.losses || 0,
      currentRank: team.currentRank
    };
  };

  const handleSchoolClick = async (school: typeof SCHOOLS[0], coach: any) => {
    if (!currentLeagueId) return;

    if (coach?.teamId) {
      navigate(`/school/${coach.teamId}`);
    } else {
      // Auto-track as CPU if not tracked
      setLoading(true);
      try {
        const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
        const newTeamRef = doc(teamsRef);
        const teamId = newTeamRef.id;

        // Check if there's an existing coach for this school
        const coachesRef = collection(db, 'coaches');
        const q = query(coachesRef, where('leagueId', '==', currentLeagueId), where('teamName', '==', school.name));
        const coachSnap = await getDocs(q);
        
        let headCoachId = null;
        if (!coachSnap.empty) {
          headCoachId = coachSnap.docs[0].id;
          // Update coach with teamId
          await updateDoc(doc(db, 'coaches', headCoachId), { teamId });
        }

        await setDoc(newTeamRef, {
          name: school.name,
          conference: school.conference,
          ownerId: 'cpu',
          isPlaceholder: false,
          headCoachId,
          wins: 0,
          losses: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        navigate(`/school/${teamId}`);
      } catch (error) {
        console.error("Error auto-tracking school:", error);
        alert("Failed to access school profile.");
      } finally {
        setLoading(false);
      }
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderCoachStatus = (coach: any, mode: ViewMode) => {
    const isUserControlled = coach?.ownerId && coach.ownerId !== 'cpu' && !coach.isPlaceholder;
    const hasCoachName = !!coach?.coachName;
    const isShadow = coach?.isPlaceholder && !isUserControlled && !hasCoachName;

    if (mode === 'list') {
      if (isUserControlled) {
        return (
          <div className="flex items-center gap-1.5 text-green-500 text-[10px] font-black uppercase tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <Users size={10} />
            {coach.coachName || 'Active'}
          </div>
        );
      }
      if (isShadow) {
        return (
          <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
            <Ghost size={10} />
            {coach.coachName || 'Shadow'}
          </div>
        );
      }
      return (
        <div className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">
          {hasCoachName ? coach.coachName : 'CPU'}
        </div>
      );
    }

    if (isUserControlled) {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-500 text-[8px] font-black uppercase tracking-widest rounded border border-green-500/20">
          <Users size={8} />
          User
        </div>
      );
    }
    
    if (isShadow) {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[8px] font-black uppercase tracking-widest rounded border border-zinc-700">
          <Ghost size={8} />
          Shadow
        </div>
      );
    }

    return (
      <div className="px-2 py-0.5 bg-zinc-900/50 text-zinc-600 text-[8px] font-black uppercase tracking-widest rounded border border-zinc-800">
        CPU
      </div>
    );
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
                <h1 className="text-xl font-black uppercase italic tracking-tight">All <span className="text-orange-600">Programs</span></h1>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">National Landscape</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-zinc-800 text-orange-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="List View"
                >
                  <List size={18} />
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'compact' ? 'bg-zinc-800 text-orange-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="Compact View"
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('large')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'large' ? 'bg-zinc-800 text-orange-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="Large View"
                >
                  <Square size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
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

            {/* Conference Pill Menu */}
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap hide-scrollbar pb-2">
              <button
                onClick={() => setSelectedConference(null)}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                  !selectedConference
                    ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                }`}
              >
                All
              </button>
              {conferences.map(conf => (
                <button
                  key={conf}
                  onClick={() => setSelectedConference(conf === selectedConference ? null : conf)}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                    selectedConference === conf
                      ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  {conf}
                </button>
              ))}
            </div>
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
          className={
            viewMode === 'list' 
              ? "flex flex-col gap-2" 
              : viewMode === 'compact'
              ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          }
        >
          <AnimatePresence mode="popLayout">
            {filteredSchools.map((school) => {
              const coach = getCoachForSchool(school.name);
              
              if (viewMode === 'list') {
                return (
                  <motion.div
                    key={school.name}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => handleSchoolClick(school, coach)}
                    className="flex items-center justify-between p-3 bg-zinc-900/40 border border-zinc-800 rounded-xl hover:border-orange-600/30 cursor-pointer group transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <TeamLogo schoolName={school.name} className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-orange-500 transition-colors">
                          {coach?.currentRank && (
                            <span className="text-orange-600 mr-1.5">#{coach.currentRank}</span>
                          )}
                          {school.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                            {school.conference}
                          </p>
                          <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest bg-zinc-800/50 px-1.5 py-0.5 rounded">
                            {coach?.wins || 0}-{coach?.losses || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {renderCoachStatus(coach, 'list')}
                    </div>
                  </motion.div>
                );
              }

              if (viewMode === 'compact') {
                return (
                  <motion.div
                    key={school.name}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => handleSchoolClick(school, coach)}
                    className="aspect-square flex flex-col items-center justify-center p-4 bg-zinc-900/40 border border-zinc-800 rounded-2xl hover:border-orange-600/30 cursor-pointer group transition-all text-center space-y-2"
                  >
                    <div className="w-12 h-12 flex items-center justify-center">
                      <TeamLogo schoolName={school.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-[10px] font-black text-white uppercase tracking-tight leading-tight line-clamp-2">
                        {coach?.currentRank && (
                          <span className="text-orange-600 mr-1">#{coach.currentRank}</span>
                        )}
                        {school.name}
                      </h3>
                      <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                        {coach?.wins || 0}-{coach?.losses || 0}
                      </p>
                    </div>
                    {renderCoachStatus(coach, 'compact')}
                  </motion.div>
                );
              }

              return (
                <SchoolCard
                  key={school.name}
                  school={school}
                  coach={coach}
                  onClick={() => handleSchoolClick(school, coach)}
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
