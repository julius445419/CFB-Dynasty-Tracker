import React, { useState, useEffect } from 'react';
import { 
  Save, 
  UserPlus, 
  Trash2, 
  School as SchoolIcon, 
  UserCircle, 
  ShieldCheck,
  AlertCircle,
  X,
  Settings2,
  Calendar,
  ChevronRight,
  Search,
  Check
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  getDocs,
  limit,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { SCHOOLS, School } from '../constants/schools';

interface League {
  id: string;
  name: string;
  ownerId: string;
  currentYear: number;
  currentWeek: number;
  seasonPhase: 'Off Season' | 'Regular Season' | 'CFP Window';
}

interface Team {
  id: string;
  name: string;
  ownerId: string;
  coachName: string;
  coachRole: 'HC' | 'OC' | 'DC';
  conference: string;
  logoId?: string;
  color?: string;
}

export const LeagueConfig = ({ user }: { user: User | null }) => {
  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states for adding a new member/team
  const [newTeamName, setNewTeamName] = useState('');
  const [newCoachName, setNewCoachName] = useState('');
  const [newCoachRole, setNewCoachRole] = useState<'HC' | 'OC' | 'DC'>('HC');
  const [newLeagueName, setNewLeagueName] = useState('This Game Sux');

  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editCoachName, setEditCoachName] = useState('');
  const [editCoachRole, setEditCoachRole] = useState<'HC' | 'OC' | 'DC'>('HC');
  const [editTeamName, setEditTeamName] = useState('');

  // Deletion State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string, name: string, type: 'team' | 'coach' } | null>(null);

  // School Search State
  const [schoolSearch, setSchoolSearch] = useState('');
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);

  const filteredSchools = SCHOOLS.filter(s => 
    s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
    s.conference.toLowerCase().includes(schoolSearch.toLowerCase())
  ).slice(0, 5);

  useEffect(() => {
    if (!user) return;

    // Fetch the first league where the user is the owner
    const leaguesQuery = query(
      collection(db, 'leagues'),
      where('ownerId', '==', user.uid),
      limit(1)
    );

    const unsubscribeLeague = onSnapshot(leaguesQuery, (snapshot) => {
      if (!snapshot.empty) {
        const leagueDoc = snapshot.docs[0];
        const leagueData = { id: leagueDoc.id, ...leagueDoc.data() } as League;
        setLeague(leagueData);

        // Fetch teams for this league
        const teamsQuery = collection(db, 'leagues', leagueDoc.id, 'teams');
        const unsubscribeTeams = onSnapshot(teamsQuery, (teamSnapshot) => {
          const teamsList = teamSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
          setTeams(teamsList);
          setLoading(false);
        });

        return () => unsubscribeTeams();
      } else {
        setLoading(false);
      }
    }, (err) => {
      console.error("Error fetching league:", err);
      setError("Failed to load league settings.");
      setLoading(false);
    });

    return () => unsubscribeLeague();
  }, [user]);

  const handleUpdatePhase = async (newPhase: 'Off Season' | 'Regular Season' | 'CFP Window') => {
    if (!league) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'leagues', league.id), { seasonPhase: newPhase });
    } catch (err) {
      console.error("Error updating phase:", err);
      setError("Failed to update season phase.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateYear = async (newYear: number) => {
    if (!league) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'leagues', league.id), { currentYear: newYear });
    } catch (err) {
      console.error("Error updating year:", err);
      setError("Failed to update season year.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateWeek = async (newWeek: number) => {
    if (!league) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'leagues', league.id), { currentWeek: newWeek });
      setSuccess(`Advanced to Week ${newWeek}.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error updating week:", err);
      setError("Failed to update season week.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!league || !selectedSchool || !newCoachName) return;

    setSaving(true);
    setError(null);
    try {
      await addDoc(collection(db, 'leagues', league.id, 'teams'), {
        name: selectedSchool.name,
        coachName: newCoachName,
        coachRole: newCoachRole,
        leagueId: league.id,
        ownerId: '', 
        conference: selectedSchool.conference,
        logoId: selectedSchool.logoId?.toString(),
        color: selectedSchool.color
      });
      setSelectedSchool(null);
      setSchoolSearch('');
      setNewCoachName('');
      setSuccess(`Successfully added ${selectedSchool.name} to the dynasty.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error adding team:", err);
      setError("Failed to add league member.");
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (team: Team) => {
    setEditingTeamId(team.id);
    setEditCoachName(team.coachName);
    setEditCoachRole(team.coachRole);
    setEditTeamName(team.name);
  };

  const handleSaveEdit = async (teamId: string) => {
    if (!league) return;
    setSaving(true);
    setError(null);
    
    // Find school data if name changed
    const schoolData = SCHOOLS.find(s => s.name === editTeamName);

    try {
      const updateData: any = {
        coachName: editCoachName,
        coachRole: editCoachRole,
        name: editTeamName
      };

      if (schoolData) {
        updateData.conference = schoolData.conference;
        updateData.logoId = schoolData.logoId?.toString();
        updateData.color = schoolData.color;
      }

      await updateDoc(doc(db, 'leagues', league.id, 'teams', teamId), updateData);
      setEditingTeamId(null);
      setSuccess("Member updated successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error updating team:", err);
      setError("Failed to update team member.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!league) return;
    setSaving(true);
    setError(null);
    try {
      await deleteDoc(doc(db, 'leagues', league.id, 'teams', teamId));
      setDeleteConfirmation(null);
      setSuccess("Program removed from dynasty.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting team:", err);
      setError("Failed to remove member. Check your permissions.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearCoach = async (teamId: string) => {
    if (!league) return;
    setSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'leagues', league.id, 'teams', teamId), {
        coachName: 'Vacant',
        coachRole: 'HC',
        ownerId: ''
      });
      setDeleteConfirmation(null);
      setSuccess("Coach cleared. School remains in dynasty.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error clearing coach:", err);
      setError("Failed to clear coach assignment.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newLeagueName) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'leagues'), {
        name: newLeagueName,
        ownerId: user.uid,
        currentYear: 2024,
        currentWeek: 1,
        seasonPhase: 'Off Season',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error creating league:", err);
      setError("Failed to create league.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-800 p-8 rounded-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-orange-600/10 rounded-full flex items-center justify-center mx-auto border border-orange-600/20">
          <ShieldCheck className="text-orange-600" size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">No Dynasty Found</h2>
          <p className="text-zinc-500">You haven't initialized your dynasty yet. Create one now to access commissioner settings.</p>
        </div>
        <form onSubmit={handleCreateLeague} className="flex gap-2">
          <input 
            type="text" 
            value={newLeagueName}
            onChange={(e) => setNewLeagueName(e.target.value)}
            placeholder="League Name"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-600 transition-colors"
            required
          />
          <button 
            type="submit"
            disabled={saving}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-2 rounded-lg transition-all disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 md:space-y-12 pb-20 px-2 sm:px-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2 md:px-0">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center shadow-xl shadow-orange-600/20">
              <Settings2 className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-4xl font-display font-black text-white tracking-tight uppercase italic">
                League <span className="text-orange-600">Control</span>
              </h1>
              <p className="text-zinc-500 font-bold text-xs uppercase tracking-[0.2em]">Dynasty Operations & Management</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 glass-surface px-6 py-3 rounded-2xl border border-white/5">
            <ShieldCheck className="text-orange-600" size={20} />
            <div className="text-left">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">Status</p>
              <p className="text-sm font-bold text-white uppercase tracking-wider">Commissioner</p>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl flex items-center gap-4 text-red-500"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
            <AlertCircle size={20} />
          </div>
          <p className="font-bold text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </motion.div>
      )}

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/20 p-6 rounded-3xl flex items-center gap-4 text-green-500"
        >
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
            <Check size={20} />
          </div>
          <p className="font-bold text-sm">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Season Settings */}
        <div className="lg:col-span-4 space-y-8">
          <section className="glass-card rounded-[2rem] md:rounded-[2.5rem] overflow-hidden border border-white/5">
            <div className="p-6 md:p-8 border-b border-white/5 bg-white/5">
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-3">
                <Calendar size={20} className="text-orange-600" />
                Season Config
              </h3>
            </div>
            <div className="p-6 md:p-8 space-y-8 md:space-y-10">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Active Year</label>
                  <span className="text-[9px] font-black text-orange-600/50 uppercase tracking-widest italic">Live Sync</span>
                </div>
                <div className="relative group">
                  <input 
                    type="number" 
                    value={league.currentYear || 2024}
                    onChange={(e) => handleUpdateYear(parseInt(e.target.value))}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white font-display font-bold text-2xl focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all group-hover:bg-white/10"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-orange-600 transition-colors">
                    <Save size={20} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Current Week</label>
                  <span className="text-[9px] font-black text-orange-600/50 uppercase tracking-widest italic">Live Sync</span>
                </div>
                <div className="relative group">
                  <input 
                    type="number" 
                    min="1"
                    max="20"
                    value={league.currentWeek || 1}
                    onChange={(e) => handleUpdateWeek(parseInt(e.target.value))}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white font-display font-bold text-2xl focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all group-hover:bg-white/10"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-orange-600 transition-colors">
                    <Save size={20} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Season Phase</label>
                <div className="flex flex-col gap-2">
                  {(['Off Season', 'Regular Season', 'CFP Window'] as const).map((phase) => (
                    <button
                      key={phase}
                      onClick={() => handleUpdatePhase(phase)}
                      className={`flex items-center justify-between px-6 py-4 rounded-2xl text-sm font-bold transition-all border ${
                        league.seasonPhase === phase 
                          ? 'bg-orange-600 border-orange-500 text-white shadow-xl shadow-orange-600/20' 
                          : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300'
                      }`}
                    >
                      {phase}
                      {league.seasonPhase === phase && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 bg-orange-600/5 relative overflow-hidden group">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-orange-600/10 rounded-full blur-3xl group-hover:bg-orange-600/20 transition-all duration-700" />
            <h4 className="text-white font-display font-bold text-lg mb-2">Commissioner Tip</h4>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Advancing the season phase updates recruiting windows and schedule availability for all users.
            </p>
          </div>
        </div>

        {/* Right Column: Member Management */}
        <div className="lg:col-span-8 space-y-8">
          <section className="glass-card rounded-[2rem] md:rounded-[2.5rem] overflow-hidden border border-white/5">
            <div className="p-6 md:p-8 border-b border-white/5 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-3">
                <UserCircle size={20} className="text-orange-600" />
                Dynasty Members
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{teams.length} / 32 COACHES</span>
                <div className="w-24 sm:w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(teams.length / 32) * 100}%` }}
                    className="h-full bg-orange-600"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 md:p-8 space-y-8">
              {/* Add Member Form */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-600/20 flex items-center justify-center">
                    <UserPlus size={16} className="text-orange-600" />
                  </div>
                  <h4 className="text-white font-bold uppercase tracking-widest text-xs">Onboard New Coach</h4>
                </div>

                <form onSubmit={handleAddTeam} className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-4">
                  <div className="md:col-span-5 relative">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">Assigned School</label>
                    <div className="relative">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500">
                        <Search size={18} />
                      </div>
                      <input 
                        type="text" 
                        placeholder="Search programs..."
                        value={selectedSchool ? selectedSchool.name : schoolSearch}
                        onChange={(e) => {
                          setSchoolSearch(e.target.value);
                          if (selectedSchool) setSelectedSchool(null);
                          setIsSchoolDropdownOpen(true);
                        }}
                        onFocus={() => setIsSchoolDropdownOpen(true)}
                        className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                      />
                      {selectedSchool && (
                        <button 
                          type="button"
                          onClick={() => {
                            setSelectedSchool(null);
                            setSchoolSearch('');
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-lg text-zinc-500"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <AnimatePresence>
                      {isSchoolDropdownOpen && schoolSearch && !selectedSchool && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute z-50 left-0 right-0 mt-2 glass-surface border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto"
                        >
                          {filteredSchools.length > 0 ? (
                            filteredSchools.map(school => (
                              <button
                                key={school.name}
                                type="button"
                                onClick={() => {
                                  setSelectedSchool(school);
                                  setIsSchoolDropdownOpen(false);
                                }}
                                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors text-left group"
                              >
                                <div 
                                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/10"
                                  style={{ backgroundColor: school.color }}
                                >
                                  <img 
                                    src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${school.logoId}.png`} 
                                    alt="" 
                                    className="w-5 h-5 object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <div>
                                  <p className="text-white font-bold text-sm group-hover:text-orange-600 transition-colors">{school.name}</p>
                                  <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{school.conference}</p>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-5 py-4 text-zinc-500 text-xs italic">No programs found</div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 ml-1">Coach Identity</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Coach Julius"
                      value={newCoachName}
                      onChange={(e) => setNewCoachName(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                      required
                    />
                  </div>

                  <div className="md:col-span-3 flex items-end">
                    <button 
                      type="submit"
                      disabled={saving || !selectedSchool}
                      className="w-full h-[54px] bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-orange-600/20 disabled:opacity-50 disabled:grayscale"
                    >
                      <UserPlus size={16} />
                      Onboard
                    </button>
                  </div>
                </form>
              </div>

              <div className="h-px bg-white/5" />

              {/* Members List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-bold uppercase tracking-widest text-xs">Active Coaching Staff</h4>
                  <div className="hidden md:flex items-center gap-4 text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                    <span>School</span>
                    <span className="w-32">Coach</span>
                    <span className="w-20">Role</span>
                    <span className="w-16">Actions</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {teams.length === 0 ? (
                    <div className="text-center py-12 glass-surface rounded-3xl border border-dashed border-white/10">
                      <UserCircle className="mx-auto text-zinc-700 mb-4" size={48} />
                      <p className="text-zinc-500 font-bold text-sm uppercase tracking-widest">No coaches registered</p>
                    </div>
                  ) : (
                    teams.map((team) => (
                      <motion.div 
                        layout
                        key={team.id}
                        className="glass-surface p-4 md:p-5 rounded-3xl border border-white/5 hover:border-orange-600/20 transition-all group relative overflow-hidden"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                          <div className="flex items-center gap-4 md:gap-5">
                            <div 
                              className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl relative group-hover:scale-105 transition-transform duration-500 shrink-0"
                              style={{ 
                                backgroundColor: team.color || '#18181b',
                                boxShadow: `0 10px 30px -10px ${team.color}44`
                              }}
                            >
                              {team.logoId ? (
                                <img 
                                  src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${team.logoId}.png`} 
                                  alt={team.name} 
                                  className="w-8 h-8 md:w-10 md:h-10 object-contain p-1 drop-shadow-lg"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <SchoolIcon className="text-white/20" size={20} />
                              )}
                            </div>
                            
                            <div className="min-w-0">
                              {editingTeamId === team.id ? (
                                <div className="space-y-2">
                                  <select 
                                    value={editTeamName}
                                    onChange={(e) => setEditTeamName(e.target.value)}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-600"
                                  >
                                    {SCHOOLS.map(s => (
                                      <option key={s.name} value={s.name}>{s.name}</option>
                                    ))}
                                  </select>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input 
                                      type="text"
                                      value={editCoachName}
                                      onChange={(e) => setEditCoachName(e.target.value)}
                                      className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-600 min-w-[120px]"
                                    />
                                    <select 
                                      value={editCoachRole}
                                      onChange={(e) => setEditCoachRole(e.target.value as any)}
                                      className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-600"
                                    >
                                      <option value="HC">HC</option>
                                      <option value="OC">OC</option>
                                      <option value="DC">DC</option>
                                    </select>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-white font-display font-bold text-base md:text-lg leading-tight group-hover:text-orange-600 transition-colors truncate">{team.name}</p>
                                  <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
                                    <p className="text-xs md:text-sm font-bold text-zinc-400 truncate">{team.coachName}</p>
                                    <span className="hidden xs:block w-1 h-1 rounded-full bg-zinc-700" />
                                    <span className={`text-[8px] md:text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                      team.coachRole === 'HC' 
                                        ? 'bg-orange-600/10 border-orange-600/20 text-orange-600' 
                                        : 'bg-white/5 border-white/10 text-zinc-500'
                                    } uppercase tracking-widest`}>
                                      {team.coachRole === 'HC' ? 'Head Coach' : team.coachRole}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 sm:ml-auto">
                            {editingTeamId === team.id ? (
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => handleSaveEdit(team.id)}
                                  className="w-10 h-10 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white rounded-xl transition-all flex items-center justify-center"
                                  title="Save Changes"
                                >
                                  <Save size={18} />
                                </button>
                                <button 
                                  onClick={() => setEditingTeamId(null)}
                                  className="w-10 h-10 bg-white/5 text-zinc-500 hover:bg-white/10 rounded-xl transition-all flex items-center justify-center"
                                  title="Cancel Edit"
                                >
                                  <X size={18} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-all lg:translate-x-4 lg:group-hover:translate-x-0">
                                <button 
                                  onClick={() => handleStartEdit(team)}
                                  className="w-10 h-10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white rounded-xl transition-all flex items-center justify-center"
                                  title="Edit Coach"
                                >
                                  <UserCircle size={18} />
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirmation({ id: team.id, name: team.name, type: 'team' })}
                                  className="w-10 h-10 bg-red-500/5 text-zinc-600 hover:bg-red-500 hover:text-white rounded-xl transition-all flex items-center justify-center"
                                  title="Remove Member"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Background Decoration */}
                        <div 
                          className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-700 pointer-events-none"
                          style={{ color: team.color }}
                        >
                          <SchoolIcon size={120} />
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmation(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass-card rounded-[2.5rem] border border-white/10 p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-red-600/10 rounded-full blur-3xl" />
              
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-red-600/20 flex items-center justify-center text-red-600">
                  <Trash2 size={32} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-bold text-white uppercase italic">
                    Remove <span className="text-red-600">Member</span>
                  </h3>
                  <p className="text-zinc-500 text-sm">
                    How would you like to handle <span className="text-white font-bold">{deleteConfirmation.name}</span>?
                  </p>
                  <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2">
                    Note: The school itself will always remain available in the master program list.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 w-full">
                  <button
                    onClick={() => handleClearCoach(deleteConfirmation.id)}
                    disabled={saving}
                    className="w-full py-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-white font-bold text-sm transition-all flex items-center justify-center gap-3"
                  >
                    <UserCircle size={18} className="text-orange-600" />
                    Clear Coach (Keep School)
                  </button>
                  
                  <button
                    onClick={() => handleDeleteTeam(deleteConfirmation.id)}
                    disabled={saving}
                    className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-xl shadow-red-600/20"
                  >
                    <Trash2 size={18} />
                    Delete Program Entirely
                  </button>
                  
                  <button
                    onClick={() => setDeleteConfirmation(null)}
                    disabled={saving}
                    className="w-full py-4 rounded-2xl text-zinc-500 hover:text-white font-bold text-sm transition-all"
                  >
                    Cancel Action
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
