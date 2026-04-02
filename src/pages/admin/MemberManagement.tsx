import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  getDoc,
  getDocs,
  writeBatch, 
  serverTimestamp,
  documentId,
  updateDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  School, 
  Search, 
  X, 
  Check, 
  Loader2,
  ChevronRight,
  UserCheck,
  Trophy,
  Ghost,
  Link as LinkIcon
} from 'lucide-react';
import { SCHOOLS } from '../../constants/schools';
import { TeamAssignment } from '../../types';

interface Member {
  id: string;
  displayName: string;
  email: string;
  role: string;
  team?: {
    school: string;
    role: string;
    coachName?: string;
  };
}

export const MemberManagement: React.FC = () => {
  const { user } = useAuth();
  const { currentLeagueId, userRole, userTeam } = useLeague();
  const [members, setMembers] = useState<Member[]>([]);
  const [shadowCoaches, setShadowCoaches] = useState<TeamAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  
  // State for Assignment
  const [selectedUser, setSelectedUser] = useState<Member | null>(null);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('HC');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [assigning, setAssigning] = useState(false);

  // State for Linking
  const [selectedShadowCoach, setSelectedShadowCoach] = useState<TeamAssignment | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!currentLeagueId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Get league members
        const membersRef = collection(db, 'leagues', currentLeagueId, 'members');
        const membersSnap = await getDocs(membersRef);
        const memberData: { id: string, role: string, displayName?: string }[] = [];
        membersSnap.forEach(doc => {
          memberData.push({ id: doc.id, role: doc.data().role, displayName: doc.data().displayName });
        });

        // Ensure owner is included in memberData if they are not already there
        const leagueRef = doc(db, 'leagues', currentLeagueId);
        const leagueSnap = await getDoc(leagueRef);
        const leagueData = leagueSnap.data();
        if (leagueData && !memberData.find(m => m.id === leagueData.ownerId)) {
          memberData.push({ id: leagueData.ownerId, role: 'owner' });
        }

        // 2. Get shadow coaches (teams with isPlaceholder: true)
        const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
        const shadowQuery = query(teamsRef, where('isPlaceholder', '==', true));
        const shadowSnap = await getDocs(shadowQuery);
        const shadowData = shadowSnap.docs.map(d => ({ id: d.id, ...d.data() } as TeamAssignment));
        setShadowCoaches(shadowData);

        if (memberData.length === 0) {
          setMembers([]);
          setLoading(false);
          return;
        }

        // 3. Get user profiles
        const usersRef = collection(db, 'users');
        const usersSnap = await getDocs(query(usersRef, where(documentId(), 'in', memberData.map(m => m.id).slice(0, 30))));
        const userProfiles: { [key: string]: any } = {};
        usersSnap.forEach(doc => {
          userProfiles[doc.id] = doc.data();
        });

        // 4. Get assigned teams (real ones)
        const realTeamsSnap = await getDocs(query(teamsRef, where('isPlaceholder', '==', false)));
        const assignedTeams: { [key: string]: any } = {};
        realTeamsSnap.forEach(doc => {
          if (doc.data().ownerId) {
            assignedTeams[doc.data().ownerId] = doc.data();
          }
        });

        const combinedMembers = memberData.map((m) => ({
          id: m.id,
          displayName: userProfiles[m.id]?.displayName || m.displayName || 'Unknown User',
          email: userProfiles[m.id]?.email || 'No Email',
          role: m.role,
          team: assignedTeams[m.id] ? {
            school: assignedTeams[m.id].name,
            role: assignedTeams[m.id].coachRole,
            coachName: assignedTeams[m.id].coachName
          } : undefined
        }));

        setMembers(combinedMembers);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentLeagueId]);

  const handleOpenAssign = (member: Member) => {
    setSelectedUser(member);
    const nameToSplit = member.team?.coachName || member.displayName;
    setFirstName(nameToSplit.split(' ')[0] || '');
    setLastName(nameToSplit.split(' ').slice(1).join(' ') || '');
    if (member.team) {
      setSelectedSchool(member.team.school);
      setSelectedRole(member.team.role);
    } else {
      setSelectedSchool(null);
      setSelectedRole('HC');
    }
    setIsAssignModalOpen(true);
  };

  const handleAssign = async () => {
    if (!currentLeagueId || !selectedUser || !selectedSchool) return;
    
    setAssigning(true);
    try {
      const batch = writeBatch(db);
      const schoolData = SCHOOLS.find(s => s.name === selectedSchool);

      const coachRef = doc(db, 'leagues', currentLeagueId, 'teams', selectedUser.id);
      batch.set(coachRef, {
        name: selectedSchool,
        school: selectedSchool, // Add both for compatibility
        coachName: `${firstName} ${lastName}`,
        firstName: firstName,
        lastName: lastName,
        coachRole: selectedRole,
        role: selectedRole, // Add both for compatibility
        leagueId: currentLeagueId,
        ownerId: selectedUser.id,
        isPlaceholder: false,
        conference: schoolData?.conference || 'Independent',
        logoId: schoolData?.logoId || null,
        color: schoolData?.color || '#000000',
        assignmentStatus: 'Active',
        contractStart: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      await batch.commit();
      
      setMembers(prev => prev.map(m => 
        m.id === selectedUser.id 
          ? { ...m, team: { school: selectedSchool, role: selectedRole, coachName: `${firstName} ${lastName}` } }
          : m
      ));
      
      setIsAssignModalOpen(false);
      setSelectedSchool(null);
      setSchoolSearch('');
    } catch (error) {
      console.error("Error assigning team:", error);
      alert("Failed to assign team.");
    } finally {
      setAssigning(false);
    }
  };

  const handleLinkAccount = async (targetUser: Member) => {
    if (!currentLeagueId || !selectedShadowCoach) return;
    
    setLinking(true);
    try {
      const batch = writeBatch(db);

      // 1. Update Shadow Coach document
      const coachRef = doc(db, 'leagues', currentLeagueId, 'teams', selectedShadowCoach.id!);
      batch.update(coachRef, {
        ownerId: targetUser.id,
        isPlaceholder: false,
        updatedAt: serverTimestamp()
      });

      // 2. Update member role to 'player' if it was 'unassigned'
      const memberRef = doc(db, 'leagues', currentLeagueId, 'members', targetUser.id);
      batch.update(memberRef, {
        role: 'player'
      });

      await batch.commit();

      // Update local state
      setShadowCoaches(prev => prev.filter(sc => sc.id !== selectedShadowCoach.id));
      setMembers(prev => prev.map(m => 
        m.id === targetUser.id 
          ? { ...m, team: { school: selectedShadowCoach.name, role: selectedShadowCoach.coachRole } }
          : m
      ));

      setIsLinkModalOpen(false);
      setSelectedShadowCoach(null);
    } catch (error) {
      console.error("Error linking account:", error);
      alert("Failed to link account.");
    } finally {
      setLinking(false);
    }
  };

  const unassignedMembers = members.filter(m => !m.team);
  const filteredUnassigned = unassignedMembers.filter(m => 
    (m.displayName?.toLowerCase() || '').includes(linkSearch.toLowerCase()) ||
    (m.email?.toLowerCase() || '').includes(linkSearch.toLowerCase())
  );

  const filteredSchools = SCHOOLS.filter(s => 
    (s.name?.toLowerCase() || '').includes(schoolSearch.toLowerCase()) ||
    (s.conference?.toLowerCase() || '').includes(schoolSearch.toLowerCase())
  ).slice(0, 5);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-4xl mx-auto pb-20">
      <header>
        <h1 className="text-2xl font-black text-white uppercase italic tracking-tight">
          Member <span className="text-orange-600">Management</span>
        </h1>
        <p className="text-sm text-zinc-500 font-medium">Manage users and assign coaching roles</p>
      </header>

      {/* Shadow Coaches Section */}
      {shadowCoaches.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Ghost className="text-zinc-500" size={20} />
            <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest italic">Shadow Coaches (Managed by Proxy)</h2>
          </div>
          <div className="grid gap-4">
            {shadowCoaches.map((sc) => (
              <div 
                key={sc.id}
                className="bg-zinc-900/30 backdrop-blur-xl rounded-2xl p-6 border border-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 opacity-80"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-zinc-800/50 flex items-center justify-center text-zinc-600 border border-zinc-700/50">
                    <Ghost size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-400 text-lg leading-tight italic">{sc.coachName}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[9px] font-black uppercase tracking-widest rounded border border-zinc-700">
                        {sc.coachRole} of {sc.name}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedShadowCoach(sc);
                    setIsLinkModalOpen(true);
                  }}
                  className="px-6 py-3 bg-zinc-800 text-zinc-400 rounded-xl text-sm font-bold hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 border border-zinc-700"
                >
                  <LinkIcon size={16} />
                  Link to Account
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Real Members Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="text-zinc-500" size={20} />
          <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest italic">Active Members</h2>
        </div>
        <div className="grid gap-4">
          {members.map((member) => (
            <div 
              key={member.id}
              className="bg-zinc-900/50 backdrop-blur-xl rounded-2xl p-6 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500 border border-zinc-700">
                  <Users size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-lg leading-tight">{member.displayName}</h3>
                    <div className="flex items-center gap-1">
                      {member.id === user?.uid && (
                        <span className="px-1.5 py-0.5 bg-orange-600 text-white text-[8px] font-black uppercase tracking-tighter rounded">YOU</span>
                      )}
                      {member.role.toLowerCase() === 'owner' && (
                        <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[8px] font-black uppercase tracking-tighter rounded border border-zinc-700">OWNER</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 font-medium">{member.email}</p>
                  {member.team?.coachName && member.team.coachName !== member.displayName && (
                    <p className="text-[10px] text-orange-500/80 font-bold italic mt-0.5">Coach: {member.team.coachName}</p>
                  )}
                  <div className="mt-2">
                    {member.team ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-green-500/20">
                        <School size={12} />
                        {member.team.role} of {member.team.school}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-zinc-700">
                        <Shield size={12} />
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleOpenAssign(member)}
                className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  member.team 
                    ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' 
                    : 'bg-orange-600 text-white shadow-lg shadow-orange-600/20 hover:bg-orange-700'
                }`}
              >
                {member.team ? 'Manage Coach' : 'Assign Coach'}
                <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Link Account Modal */}
      <AnimatePresence>
        {isLinkModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLinkModalOpen(false)}
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
                <div>
                  <h2 className="text-xl font-black text-white uppercase italic">Link <span className="text-orange-600">Account</span></h2>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Linking {selectedShadowCoach?.coachName} ({selectedShadowCoach?.name})</p>
                </div>
                <button onClick={() => setIsLinkModalOpen(false)} className="p-2 bg-zinc-800 rounded-full text-zinc-400">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search unassigned users..."
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50"
                  />
                </div>

                <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {filteredUnassigned.length > 0 ? (
                    filteredUnassigned.map(member => (
                      <button
                        key={member.id}
                        onClick={() => handleLinkAccount(member)}
                        disabled={linking}
                        className="w-full flex items-center justify-between p-4 bg-zinc-800/50 border border-zinc-700 rounded-2xl hover:border-orange-600/50 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-500">
                            <Users size={20} />
                          </div>
                          <div className="text-left">
                            <p className="text-white font-bold text-sm">{member.displayName}</p>
                            <p className="text-zinc-500 text-[10px] font-bold">{member.email}</p>
                          </div>
                        </div>
                        {linking ? <Loader2 className="animate-spin text-orange-500" size={18} /> : <ChevronRight size={18} className="text-zinc-600 group-hover:text-orange-500" />}
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-zinc-500 text-sm font-bold">No unassigned members found.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Assignment Modal (Existing) */}
      <AnimatePresence>
        {isAssignModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAssignModalOpen(false)}
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
                <div>
                  <h2 className="text-xl font-black text-white uppercase italic">
                    {selectedUser?.team ? 'Manage' : 'Assign'} <span className="text-orange-600">Coach</span>
                  </h2>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                    {selectedUser?.team ? 'Updating' : 'Assigning'} {selectedUser?.displayName}
                  </p>
                </div>
                <button onClick={() => setIsAssignModalOpen(false)} className="p-2 bg-zinc-800 rounded-full text-zinc-400">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">First Name</label>
                    <input 
                      type="text" 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Last Name</label>
                    <input 
                      type="text" 
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Search School</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search schools..."
                      value={schoolSearch}
                      onChange={(e) => setSchoolSearch(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50"
                    />
                  </div>
                  
                  {schoolSearch && (
                    <div className="mt-2 space-y-2">
                      {filteredSchools.map(school => (
                        <button
                          key={school.name}
                          onClick={() => {
                            setSelectedSchool(school.name);
                            setSchoolSearch('');
                          }}
                          className="w-full flex items-center justify-between p-4 bg-zinc-800 border border-zinc-700 rounded-2xl hover:border-orange-600/50 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center p-1">
                              <img src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${school.logoId}.png`} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                            </div>
                            <div className="text-left">
                              <p className="text-white font-bold text-sm">{school.name}</p>
                              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{school.conference}</p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-zinc-600" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedSchool && (
                  <div className="p-4 bg-orange-600/10 border border-orange-600/20 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <School className="text-orange-500" size={20} />
                      <p className="text-white font-bold">{selectedSchool}</p>
                    </div>
                    <button onClick={() => setSelectedSchool(null)} className="text-orange-500 text-[10px] font-black uppercase tracking-widest">Change</button>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Coaching Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['HC', 'OC', 'DC'].map(role => (
                      <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`py-3 rounded-xl font-black text-xs transition-all border ${
                          selectedRole === role 
                            ? 'bg-orange-600 border-orange-500 text-white' 
                            : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  disabled={assigning || !selectedSchool}
                  onClick={handleAssign}
                  className="w-full bg-white text-black font-black py-5 rounded-2xl shadow-xl shadow-white/5 hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {assigning ? <Loader2 className="animate-spin" size={20} /> : <UserCheck size={20} />}
                  {selectedUser?.team ? 'UPDATE COACH' : 'ASSIGN COACH'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
