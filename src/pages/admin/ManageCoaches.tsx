import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  Loader2, 
  Shield, 
  UserPlus,
  ArrowLeft
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  serverTimestamp,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { CarouselCoach, TeamAssignment, Poll } from '../../types';
import { useNavigate } from 'react-router-dom';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ManageCoaches: React.FC = () => {
  const { currentLeagueId, leagueInfo } = useLeague();
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState<CarouselCoach[]>([]);
  const [teams, setTeams] = useState<TeamAssignment[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedConferences, setSelectedConferences] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<CarouselCoach | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [userPermissions, setUserPermissions] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    role: 'HC' as 'HC' | 'OC' | 'DC' | 'Unassigned',
    teamId: '',
    careerWins: 0,
    careerLosses: 0,
    schoolWins: 0,
    schoolLosses: 0
  });

  useEffect(() => {
    if (!currentLeagueId) return;
    fetchData();
  }, [currentLeagueId, leagueInfo?.currentYear, leagueInfo?.currentWeek]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch User Permissions
      if (auth.currentUser && currentLeagueId) {
        const memberRef = doc(db, 'leagues', currentLeagueId, 'members', auth.currentUser.uid);
        const memberSnap = await getDoc(memberRef);
        if (memberSnap.exists()) {
          setUserPermissions(memberSnap.data().permissions || {});
        }
      }

      // Fetch Coaches
      const coachesRef = collection(db, 'coaches');
      const coachesQuery = query(coachesRef, where('leagueId', '==', currentLeagueId));
      const coachesSnap = await getDocs(coachesQuery);
      const coachesData = coachesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CarouselCoach[];
      setCoaches(coachesData);

      // Fetch Teams
      const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
      const teamsSnap = await getDocs(teamsRef);
      const teamsData = teamsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeamAssignment[];
      setTeams(teamsData);

      // Fetch Latest Polls
      if (leagueInfo) {
        const pollsRef = collection(db, 'polls');
        const pollsQuery = query(
          pollsRef, 
          where('leagueId', '==', currentLeagueId),
          where('seasonYear', '==', leagueInfo.currentYear),
          where('week', '==', leagueInfo.currentWeek)
        );
        const pollsSnap = await getDocs(pollsQuery);
        const pollsData = pollsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Poll[];
        setPolls(pollsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (coach: CarouselCoach | null = null) => {
    if (coach) {
      setEditingCoach(coach);
      setFormData({
        name: coach.name,
        role: coach.role,
        teamId: coach.teamId || '',
        careerWins: coach.careerWins || 0,
        careerLosses: coach.careerLosses || 0,
        schoolWins: coach.schoolWins || 0,
        schoolLosses: coach.schoolLosses || 0
      });
    } else {
      setEditingCoach(null);
      setFormData({
        name: '',
        role: 'HC',
        teamId: '',
        careerWins: 0,
        careerLosses: 0,
        schoolWins: 0,
        schoolLosses: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLeagueId) return;
    setIsSaving(true);

    try {
      const batch = writeBatch(db);
      const coachId = editingCoach?.id || doc(collection(db, 'coaches')).id;
      const coachRef = doc(db, 'coaches', coachId);

      const coachData = {
        leagueId: currentLeagueId,
        name: formData.name,
        role: formData.role,
        teamId: formData.teamId || null,
        careerWins: Number(formData.careerWins),
        careerLosses: Number(formData.careerLosses),
        schoolWins: Number(formData.schoolWins),
        schoolLosses: Number(formData.schoolLosses),
        updatedAt: serverTimestamp(),
        ...(editingCoach ? {} : { createdAt: serverTimestamp() })
      };

      batch.set(coachRef, coachData, { merge: true });

      // RELATIONAL SYNC LOGIC
      
      // 1. If coach was previously assigned to a team, clear that team's reference
      if (editingCoach?.teamId && editingCoach.role !== 'Unassigned') {
        const oldTeamRef = doc(db, 'leagues', currentLeagueId, 'teams', editingCoach.teamId);
        const oldRoleField = editingCoach.role === 'HC' ? 'headCoachId' : editingCoach.role === 'OC' ? 'ocId' : 'dcId';
        batch.update(oldTeamRef, { [oldRoleField]: null });
      }

      // 2. If coach is being assigned to a new team, update that team's reference
      if (formData.teamId && formData.role !== 'Unassigned') {
        const newTeamRef = doc(db, 'leagues', currentLeagueId, 'teams', formData.teamId);
        const newRoleField = formData.role === 'HC' ? 'headCoachId' : formData.role === 'OC' ? 'ocId' : 'dcId';
        
        const updateData: any = { [newRoleField]: coachId };
        
        // If this is a Head Coach and they are linked to a user, update the team's ownerId
        if (formData.role === 'HC' && editingCoach?.userId) {
          updateData.ownerId = editingCoach.userId;
          updateData.isPlaceholder = false;
        }
        
        batch.update(newTeamRef, updateData);
      }

      await batch.commit();
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'coaches/batch');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCoach = async (coach: CarouselCoach) => {
    if (!canDelete) {
      alert("You do not have permission to delete personas.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${coach.name}?`)) return;
    if (!currentLeagueId) return;

    try {
      const batch = writeBatch(db);
      
      // Remove from coaches collection
      batch.delete(doc(db, 'coaches', coach.id));

      // Remove from team reference if assigned
      if (coach.teamId && coach.role !== 'Unassigned') {
        const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', coach.teamId);
        const roleField = coach.role === 'HC' ? 'headCoachId' : coach.role === 'OC' ? 'ocId' : 'dcId';
        batch.update(teamRef, { [roleField]: null });
      }

      await batch.commit();
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `coaches/${coach.id}`);
    }
  };

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return 'Unassigned';
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown Team';
  };

  const getTeamRecord = (teamId: string | null) => {
    if (!teamId) return null;
    const team = teams.find(t => t.id === teamId);
    if (!team) return null;
    return `${team.wins || 0}-${team.losses || 0}`;
  };

  const getTeamRank = (teamId: string | null) => {
    if (!teamId || polls.length === 0) return null;
    
    // Priority: CFP > Media
    const cfpPoll = polls.find(p => p.pollType === 'CFP');
    const mediaPoll = polls.find(p => p.pollType === 'Media');
    
    const activePoll = cfpPoll || mediaPoll;
    if (!activePoll) return null;
    
    const ranking = activePoll.rankings.find(r => r.teamId === teamId);
    return ranking ? ranking.rank : null;
  };

  const conferences: string[] = Array.from(new Set(teams.map(t => t.conference))).map(c => String(c)).sort();
  const roles = ['HC', 'OC', 'DC', 'Unassigned'];

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const toggleConference = (conf: string) => {
    setSelectedConferences(prev => 
      prev.includes(conf) ? prev.filter(c => c !== conf) : [...prev, conf]
    );
  };

  const canDelete = leagueInfo?.ownerId === auth.currentUser?.uid || 
                    userPermissions?.canDeleteCoaches === true || 
                    auth.currentUser?.email === 'julius445419@gmail.com';

  const filteredCoaches = coaches.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(c.role);
    
    let matchesConference = true;
    if (selectedConferences.length > 0) {
      const team = teams.find(t => t.id === c.teamId);
      matchesConference = team ? selectedConferences.includes(team.conference) : false;
    }
    
    return matchesSearch && matchesRole && matchesConference;
  });

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <button 
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all mb-4"
            >
              <ArrowLeft size={14} />
              Back to Admin
            </button>
            <h1 className="text-3xl font-black uppercase italic tracking-tight flex items-center gap-3">
              Manage <span className="text-orange-600">Coaches</span>
            </h1>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Relational Coaching Carousel Database</p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-orange-600/20"
          >
            <Plus size={16} />
            Add New Coach
          </button>
        </div>

        {/* Search & Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Search coaches by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
            />
          </div>

          <div className="flex flex-col gap-4">
            {/* Role Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mr-2">Roles:</span>
              <button
                onClick={() => setSelectedRoles([])}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                  selectedRoles.length === 0
                    ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                }`}
              >
                All Roles
              </button>
              {roles.map(role => (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                    selectedRoles.includes(role)
                      ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>

            {/* Conference Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mr-2">Conferences:</span>
              <button
                onClick={() => setSelectedConferences([])}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                  selectedConferences.length === 0
                    ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                }`}
              >
                All Conferences
              </button>
              {conferences.map(conf => (
                <button
                  key={conf}
                  onClick={() => toggleConference(conf)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                    selectedConferences.includes(conf)
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

        {/* Coach List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoaches.map((coach) => (
            <motion.div
              key={coach.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[32px] p-6 space-y-6 hover:border-zinc-700 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-700 group-hover:border-orange-500/50 transition-all">
                    <Users className="text-zinc-500 group-hover:text-orange-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase italic tracking-tight">{coach.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-orange-600/10 text-orange-500 text-[10px] font-black uppercase tracking-widest rounded-md border border-orange-600/20">
                        {coach.role}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        {getTeamName(coach.teamId)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {coach.teamId && (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        {getTeamRank(coach.teamId) && (
                          <span className="text-orange-500 font-black italic text-sm">
                            #{getTeamRank(coach.teamId)}
                          </span>
                        )}
                        <span className="text-xs font-black text-white bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-700">
                          {getTeamRecord(coach.teamId)}
                        </span>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => handleOpenModal(coach)}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteCoach(coach)}
                      className="p-2 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-500 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Career Record</p>
                  <p className="text-xl font-black text-white">{coach.careerWins}-{coach.careerLosses}</p>
                </div>
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">School Record</p>
                  <p className="text-xl font-black text-white">{coach.schoolWins}-{coach.schoolLosses}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredCoaches.length === 0 && (
          <div className="text-center py-20 bg-zinc-900/50 border border-zinc-800 border-dashed rounded-[40px]">
            <Users className="mx-auto h-12 w-12 text-zinc-800 mb-4" />
            <h3 className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No coaches found</h3>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]"
            >
              {/* Header - Sticky */}
              <div className="p-6 sm:p-8 border-b border-zinc-800/50 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">
                      {editingCoach ? 'Edit' : 'Add'} <span className="text-orange-600">Coach</span>
                    </h2>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Configure coach profile and assignment</p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-full transition-all hover:text-white"
                    aria-label="Close modal"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 pt-4 sm:pt-6 custom-scrollbar">
                <form id="coach-form" onSubmit={handleSaveCoach} className="space-y-6 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Full Name</label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                        placeholder="e.g. Kirby Smart"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Role</label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                      >
                        <option value="HC">Head Coach (HC)</option>
                        <option value="OC">Offensive Coordinator (OC)</option>
                        <option value="DC">Defensive Coordinator (DC)</option>
                        <option value="Unassigned">Unassigned / Free Agent</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Team Assignment</label>
                    <select
                      value={formData.teamId}
                      onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                    >
                      <option value="">Unassigned / Free Agent</option>
                      {teams.sort((a, b) => a.name.localeCompare(b.name)).map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Career W</label>
                      <input
                        type="number"
                        value={formData.careerWins}
                        onChange={(e) => setFormData({ ...formData, careerWins: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Career L</label>
                      <input
                        type="number"
                        value={formData.careerLosses}
                        onChange={(e) => setFormData({ ...formData, careerLosses: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">School W</label>
                      <input
                        type="number"
                        value={formData.schoolWins}
                        onChange={(e) => setFormData({ ...formData, schoolWins: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">School L</label>
                      <input
                        type="number"
                        value={formData.schoolLosses}
                        onChange={(e) => setFormData({ ...formData, schoolLosses: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                      />
                    </div>
                  </div>
                </form>
              </div>

              {/* Footer - Sticky */}
              <div className="p-6 sm:p-8 border-t border-zinc-800/50 bg-zinc-900/50 backdrop-blur-md shrink-0">
                <button
                  type="submit"
                  form="coach-form"
                  disabled={isSaving}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Coach...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      {editingCoach ? 'Update Coach' : 'Create Coach'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManageCoaches;
