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
  updateDoc,
  setDoc,
  deleteField
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
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
  Link as LinkIcon,
  Settings2,
  Calendar,
  BarChart3,
  Lock,
  Copy,
  RefreshCw,
  Mail,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { SCHOOLS } from '../../constants/schools';
import { TeamAssignment, CarouselCoach, Game } from '../../types';

interface Member {
  id: string;
  displayName: string;
  systemName?: string;
  email: string;
  role: string;
  permissions?: {
    canEditSchedule?: boolean;
    canEditStandings?: boolean;
    canManageMembers?: boolean;
    canEditPolls?: boolean;
    canDeleteCoaches?: boolean;
    canDeleteLeague?: boolean;
  };
  team?: {
    school: string;
    role: string;
    coachName?: string;
  };
}

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

export const MemberManagement: React.FC = () => {
  const { user } = useAuth();
  const { currentLeagueId, userRole, userTeam } = useLeague();
  const [members, setMembers] = useState<Member[]>([]);
  const [allTeams, setAllTeams] = useState<TeamAssignment[]>([]);
  const [availableCoaches, setAvailableCoaches] = useState<CarouselCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'staffing' | 'permissions'>('staffing');
  
  // Staffing Filters & Search
  const [staffingFilter, setStaffingFilter] = useState<'ALL' | 'USER' | 'CPU' | 'VACANCY'>('ALL');
  const [staffingSearch, setStaffingSearch] = useState('');
  
  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [personaSearch, setPersonaSearch] = useState('');
  const [assigningPersona, setAssigningPersona] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ school: string, role: 'HC' | 'OC' | 'DC' } | null>(null);
  
  // State for Assignment
  const [selectedUser, setSelectedUser] = useState<Member | null>(null);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'HC' | 'OC' | 'DC'>('HC');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [assigning, setAssigning] = useState(false);

  // State for Linking
  const [selectedShadowCoach, setSelectedShadowCoach] = useState<TeamAssignment | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linking, setLinking] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [editingGhostCoach, setEditingGhostCoach] = useState<TeamAssignment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editRole, setEditRole] = useState<'HC' | 'OC' | 'DC'>('HC');
  const [editSchool, setEditSchool] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  const generateInviteCode = async (coachId: string) => {
    setGeneratingCode(true);
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const coachRef = doc(db, 'leagues', currentLeagueId!, 'teams', coachId);
      await updateDoc(coachRef, {
        inviteCode: code,
        updatedAt: serverTimestamp()
      });
      setAllTeams(prev => prev.map(sc => sc.id === coachId ? { ...sc, inviteCode: code } : sc));
    } catch (error) {
      console.error("Error generating invite code:", error);
      alert("Failed to generate invite code.");
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleEditGhostCoach = async () => {
    if (!currentLeagueId || !editingGhostCoach) return;
    setSavingEdit(true);
    try {
      const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
      const coachRef = editingGhostCoach.id 
        ? doc(db, 'leagues', currentLeagueId, 'teams', editingGhostCoach.id)
        : doc(teamsRef); // Create new doc if no ID

      const schoolData = SCHOOLS.find(s => s.name === editSchool);
      const coachData: any = {
        coachName: `${editFirstName} ${editLastName}`,
        firstName: editFirstName,
        lastName: editLastName,
        name: editSchool,
        school: editSchool,
        coachRole: editRole,
        role: editRole,
        conference: schoolData?.conference || 'Independent',
        logoId: schoolData?.logoId || null,
        color: schoolData?.color || '#000000',
        isPlaceholder: true,
        ownerId: 'cpu',
        updatedAt: serverTimestamp(),
      };

      if (!editingGhostCoach.id) {
        coachData.createdAt = serverTimestamp();
      }

      if (editingGhostCoach.id) {
        await updateDoc(coachRef, coachData);
        
        // Also update linked persona if it exists
        const linkedPersona = availableCoaches.find(c => c.teamId === editingGhostCoach.id);
        if (linkedPersona) {
          await updateDoc(doc(db, 'coaches', linkedPersona.id), {
            name: coachData.coachName,
            updatedAt: serverTimestamp()
          });
          setAvailableCoaches(prev => prev.map(c => c.id === linkedPersona.id ? { ...c, name: coachData.coachName } : c));
        }

        setAllTeams(prev => prev.map(sc => sc.id === editingGhostCoach.id ? { 
          ...sc, 
          ...coachData,
          updatedAt: new Date() // Optimistic update
        } : sc));
      } else {
        await setDoc(coachRef, { ...coachData, leagueId: currentLeagueId });
        setAllTeams(prev => [...prev, { id: coachRef.id, ...coachData, leagueId: currentLeagueId }]);
      }

      setIsEditModalOpen(false);
      setEditingGhostCoach(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `leagues/${currentLeagueId}/teams/${editingGhostCoach?.id || 'new'}`);
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    if (!currentLeagueId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Get league members
        const membersRef = collection(db, 'leagues', currentLeagueId, 'members');
        const membersSnap = await getDocs(membersRef);
        const memberData: { id: string, role: string, displayName?: string, permissions?: any }[] = [];
        membersSnap.forEach(doc => {
          memberData.push({ 
            id: doc.id, 
            role: doc.data().role, 
            displayName: doc.data().displayName,
            permissions: doc.data().permissions
          });
        });

        // Ensure owner is included in memberData
        const leagueRef = doc(db, 'leagues', currentLeagueId);
        const leagueSnap = await getDoc(leagueRef);
        const leagueData = leagueSnap.data();
        
        if (leagueData && !memberData.find(m => m.id === leagueData.ownerId)) {
          memberData.push({ id: leagueData.ownerId, role: 'owner' });
        }

        // 2. Get all teams for the league
        const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
        const teamsSnap = await getDocs(teamsRef);
        const teamsData = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TeamAssignment));
        setAllTeams(teamsData);

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

        // 4. Force owner/admin roles for the list
        memberData.forEach(m => {
          if (m.id === leagueData?.ownerId || userProfiles[m.id]?.email === 'julius445419@gmail.com') {
            m.role = 'owner';
          }
        });

        // 4. Get assigned teams (real ones)
        const assignedTeams: { [key: string]: any } = {};
        teamsData.forEach(team => {
          if (!team.isPlaceholder && team.ownerId && team.ownerId !== 'cpu') {
            assignedTeams[team.ownerId] = team;
          }
        });

        // 5. Get available coaches
        const coachesRef = collection(db, 'coaches');
        const coachesSnap = await getDocs(query(coachesRef, where('leagueId', '==', currentLeagueId)));
        const coachesData = coachesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CarouselCoach));
        setAvailableCoaches(coachesData);

        const combinedMembers = memberData.map((m) => ({
          id: m.id,
          displayName: userProfiles[m.id]?.displayName || m.displayName || 'Unknown User',
          systemName: userProfiles[m.id]?.systemName || userProfiles[m.id]?.displayName || m.displayName || 'Unknown User',
          email: userProfiles[m.id]?.email || 'No Email',
          role: m.role,
          permissions: m.permissions || {},
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
      setSelectedRole(member.team.role as 'HC' | 'OC' | 'DC');
    } else {
      setSelectedSchool(null);
      setSelectedRole('HC');
    }
    setIsAssignModalOpen(true);
  };

  const handleAssign = async () => {
    if (!currentLeagueId || !selectedUser || !selectedSchool) return;
    
    // Validation: One Human per Program
    const program = staffingRegistry.find(p => p.school === selectedSchool);
    if (program?.isClaimed && !Object.values(program.slots).some(s => s.slot?.ownerId === selectedUser.id)) {
      alert(`Program already claimed by ${program.claimantName}`);
      return;
    }

    setAssigning(true);
    try {
      const batch = writeBatch(db);
      const schoolData = SCHOOLS.find(s => s.name === selectedSchool);

      // 1. Check if there's an existing team document for this school (e.g. CPU team)
      const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
      const schoolQuery = query(teamsRef, where('name', '==', selectedSchool));
      const schoolSnap = await getDocs(schoolQuery);
      
      let coachRef;
      if (!schoolSnap.empty) {
        // Update existing school document
        coachRef = schoolSnap.docs[0].ref;
      } else {
        // Create new school document (use user.id as ID for consistency in user-first flow)
        coachRef = doc(db, 'leagues', currentLeagueId, 'teams', selectedUser.id);
      }

      batch.set(coachRef, {
        name: selectedSchool,
        school: selectedSchool,
        coachName: `${firstName} ${lastName}`,
        firstName: firstName,
        lastName: lastName,
        coachRole: selectedRole,
        role: selectedRole,
        leagueId: currentLeagueId,
        ownerId: selectedUser.id,
        isPlaceholder: false,
        conference: schoolData?.conference || 'Independent',
        logoId: schoolData?.logoId || null,
        color: schoolData?.color || '#000000',
        assignmentStatus: 'Active',
        contractStart: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });

      // 2. Unlink user from any OTHER team they might have had
      const userTeamsSnap = await getDocs(query(teamsRef, where('ownerId', '==', selectedUser.id)));
      userTeamsSnap.forEach(teamDoc => {
        if (teamDoc.id !== coachRef.id) {
          batch.update(teamDoc.ref, { 
            ownerId: 'cpu', 
            isPlaceholder: false,
            updatedAt: serverTimestamp() 
          });
        }
      });

      await batch.commit();
      
      // Update local state for all teams
      setAllTeams(prev => prev.map(t => {
        // The new team
        if (t.id === coachRef.id) {
          return { 
            ...t, 
            name: selectedSchool,
            school: selectedSchool,
            coachName: `${firstName} ${lastName}`,
            firstName,
            lastName,
            coachRole: selectedRole,
            role: selectedRole,
            ownerId: selectedUser.id,
            isPlaceholder: false
          };
        }
        // Previous teams unlinked
        if (t.ownerId === selectedUser.id) {
          return { ...t, ownerId: 'cpu', isPlaceholder: false };
        }
        return t;
      }));

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

      // 1. Unlink user from any previous team they might have had
      const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
      const userTeamsSnap = await getDocs(query(teamsRef, where('ownerId', '==', targetUser.id)));
      userTeamsSnap.forEach(teamDoc => {
        batch.update(teamDoc.ref, { 
          ownerId: 'cpu', 
          isPlaceholder: false,
          updatedAt: serverTimestamp() 
        });
      });

      // 2. Update Shadow Coach document to be owned by this user
      const coachRef = doc(db, 'leagues', currentLeagueId, 'teams', selectedShadowCoach.id!);
      batch.update(coachRef, {
        ownerId: targetUser.id,
        isPlaceholder: false,
        updatedAt: serverTimestamp()
      });

      // 3. Update member role to 'player' ONLY if it was 'unassigned'
      if (targetUser.role === 'unassigned') {
        const memberRef = doc(db, 'leagues', currentLeagueId, 'members', targetUser.id);
        batch.update(memberRef, {
          role: 'player'
        });
      }

      await batch.commit();

      // Update local state
      setAllTeams(prev => prev.map(t => {
        // The new team
        if (t.id === selectedShadowCoach.id) {
          return { ...t, ownerId: targetUser.id, isPlaceholder: false };
        }
        // Previous teams unlinked
        if (t.ownerId === targetUser.id) {
          return { ...t, ownerId: 'cpu', isPlaceholder: false };
        }
        return t;
      }));
      
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

  const handleLinkCoachPersona = async (userId: string, coachId: string | null) => {
    if (!currentLeagueId) return;
    
    try {
      const batch = writeBatch(db);
      
      // 1. Clear any existing link for this user in coaches collection
      const existingCoach = availableCoaches.find(c => c.userId === userId);
      if (existingCoach) {
        const existingCoachRef = doc(db, 'coaches', existingCoach.id);
        batch.update(existingCoachRef, { userId: null, updatedAt: serverTimestamp() });
        
        // Also clear the ownerId on the team document if it was linked to this user
        if (existingCoach.teamId) {
          const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', existingCoach.teamId);
          batch.update(teamRef, { 
            ownerId: 'cpu', 
            isPlaceholder: false,
            updatedAt: serverTimestamp() 
          });
        }
      }
      
      // 2. Clear any existing team ownership for this user in teams collection
      const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
      const userTeamsSnap = await getDocs(query(teamsRef, where('ownerId', '==', userId)));
      userTeamsSnap.forEach(teamDoc => {
        batch.update(teamDoc.ref, { 
          ownerId: 'cpu', 
          isPlaceholder: false,
          updatedAt: serverTimestamp() 
        });
      });
      
      // 3. Set new link for the coach persona
      if (coachId) {
        const newCoach = availableCoaches.find(c => c.id === coachId);
        
        // Clear any existing user link on this coach persona (if it was linked to someone else)
        if (newCoach && newCoach.userId && newCoach.userId !== userId) {
          // This is implicitly handled by the update below, but we should be aware
        }
        
        const coachRef = doc(db, 'coaches', coachId);
        batch.update(coachRef, { userId: userId, updatedAt: serverTimestamp() });
        
        // 4. Update the ownerId on the team document associated with this coach
        if (newCoach && newCoach.teamId) {
          const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', newCoach.teamId);
          batch.update(teamRef, { 
            ownerId: userId, 
            isPlaceholder: false,
            updatedAt: serverTimestamp() 
          });
        }
      }
      
      await batch.commit();
      
      // Update local state
      setAvailableCoaches(prev => prev.map(c => {
        // Clear previous link for this user
        if (c.userId === userId) return { ...c, userId: undefined };
        // Set new link
        if (c.id === coachId) return { ...c, userId: userId };
        return c;
      }));
      
      // Refresh members to show updated team info
      // (In a real app, we might want to trigger a full refresh or update state more precisely)
      
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'coaches/link');
    }
  };

  const handleUpdatePermission = async (memberId: string, permission: string, value: boolean) => {
    if (!currentLeagueId) return;
    const path = `leagues/${currentLeagueId}/members/${memberId}`;
    try {
      const memberRef = doc(db, 'leagues', currentLeagueId, 'members', memberId);
      await setDoc(memberRef, {
        permissions: {
          [permission]: value
        }
      }, { merge: true });
      
      setMembers(prev => prev.map(m => 
        m.id === memberId 
          ? { ...m, permissions: { ...m.permissions, [permission]: value } }
          : m
      ));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!currentLeagueId) return;
    const path = `leagues/${currentLeagueId}/members/${memberId}`;
    try {
      const memberRef = doc(db, 'leagues', currentLeagueId, 'members', memberId);
      await setDoc(memberRef, {
        role: newRole
      }, { merge: true });
      
      setMembers(prev => prev.map(m => 
        m.id === memberId ? { ...m, role: newRole } : m
      ));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const staffingRegistry = React.useMemo(() => {
    const registry: Record<string, { 
      school: string, 
      logoId: any, 
      color: any, 
      isClaimed: boolean,
      claimantName?: string,
      slots: Record<string, { slot: TeamAssignment | null, persona: CarouselCoach | null }> 
    }> = {};
    
    // Initialize with all schools
    SCHOOLS.forEach(school => {
      registry[school.name] = {
        school: school.name,
        logoId: school.logoId,
        color: school.color,
        isClaimed: false,
        slots: { 
          'HC': { slot: null, persona: null }, 
          'OC': { slot: null, persona: null }, 
          'DC': { slot: null, persona: null } 
        }
      };
    });

    // Fill in slots from allTeams
    allTeams.forEach(team => {
      const schoolName = team.name || team.school;
      if (schoolName && registry[schoolName]) {
        const role = team.coachRole || 'HC';
        if (registry[schoolName].slots[role]) {
          registry[schoolName].slots[role].slot = team;
        }
      }
    });

    // Fill in personas
    availableCoaches.forEach(coach => {
      const team = allTeams.find(t => t.id === coach.teamId);
      if (team) {
        const schoolName = team.name || team.school;
        if (schoolName && registry[schoolName]) {
          const role = coach.role as string;
          if (registry[schoolName].slots[role]) {
            registry[schoolName].slots[role].persona = coach;
          }
        }
      }
    });
    
    // Determine Claimed status and identify the claimant
    return Object.values(registry).map(program => {
      let claimantName: string | undefined;
      const isClaimed = Object.values(program.slots).some(s => {
        const slot = s.slot;
        if (!slot) return false;
        
        // Active User
        const pilot = members.find(m => m.id === slot.ownerId);
        if (slot.ownerId && slot.ownerId !== 'cpu' && pilot) {
          claimantName = pilot.systemName;
          return true;
        }
        
        // Shadow User
        if (slot.isPlaceholder) {
          claimantName = "Shadow Coach";
          return true;
        }
        
        return false;
      });
      return { ...program, isClaimed, claimantName };
    }).sort((a, b) => a.school.localeCompare(b.school));
  }, [allTeams, availableCoaches, members]);

  const filteredStaffing = React.useMemo(() => {
    return staffingRegistry.filter(program => {
      // 1. Apply Pill Filters
      if (staffingFilter === 'USER') {
        if (!program.isClaimed) return false;
      } else if (staffingFilter === 'CPU') {
        if (program.isClaimed) return false;
      } else if (staffingFilter === 'VACANCY') {
        const hasVacancy = Object.values(program.slots).some(s => !(s.slot?.coachName || s.persona?.name));
        if (!hasVacancy) return false;
      }

      // 2. Apply Search
      if (staffingSearch) {
        const search = staffingSearch.toLowerCase();
        const schoolMatch = program.school.toLowerCase().includes(search);
        
        const coachMatch = Object.values(program.slots).some(s => {
          const displayName = s.slot?.coachName || s.persona?.name || '';
          return displayName.toLowerCase().includes(search);
        });

        const pilotMatch = Object.values(program.slots).some(s => {
          const pilot = s.slot?.ownerId ? members.find(m => m.id === s.slot.ownerId) : null;
          return pilot?.systemName?.toLowerCase().includes(search) || pilot?.displayName?.toLowerCase().includes(search);
        });

        if (!schoolMatch && !coachMatch && !pilotMatch) return false;
      }

      return true;
    });
  }, [staffingRegistry, staffingFilter, staffingSearch, members]);

  const getSlotStatus = (slot: TeamAssignment | null) => {
    if (!slot) return 'CPU';
    if (slot.ownerId && slot.ownerId !== 'cpu' && members.some(m => m.id === slot.ownerId)) return 'ACTIVE';
    if (slot.isPlaceholder) return 'SHADOW';
    return 'CPU';
  };

  const handleCreateShadow = async (programName: string, role: 'HC' | 'OC' | 'DC', persona: CarouselCoach | null, existingSlot: TeamAssignment | null) => {
    if (!currentLeagueId) return;

    // Validation: One Human per Program
    const program = staffingRegistry.find(p => p.school === programName);
    if (program?.isClaimed) {
      alert(`Program already claimed by ${program.claimantName}`);
      return;
    }

    // Persona Requirement
    if (!persona && (!existingSlot || !existingSlot.coachName)) {
      // If vacant and no persona, we must force persona assignment first
      setSelectedSlot({ school: programName, role });
      setIsPersonaModalOpen(true);
      return;
    }

    try {
      const batch = writeBatch(db);
      const schoolData = SCHOOLS.find(s => s.name === programName);
      const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
      
      const coachRef = existingSlot?.id 
        ? doc(db, 'leagues', currentLeagueId, 'teams', existingSlot.id)
        : doc(teamsRef);

      const shadowData: any = {
        name: programName,
        school: programName,
        coachRole: role,
        role: role,
        isPlaceholder: true,
        ownerId: 'cpu',
        coachName: persona?.name || existingSlot?.coachName,
        firstName: (persona?.name || existingSlot?.coachName)?.split(' ')[0],
        lastName: (persona?.name || existingSlot?.coachName)?.split(' ').slice(1).join(' '),
        conference: schoolData?.conference || 'Independent',
        logoId: schoolData?.logoId || null,
        color: schoolData?.color || '#000000',
        updatedAt: serverTimestamp(),
      };

      if (!existingSlot?.id) {
        shadowData.createdAt = serverTimestamp();
      }

      batch.set(coachRef, { ...shadowData, leagueId: currentLeagueId }, { merge: true });
      await batch.commit();

      setAllTeams(prev => {
        const exists = prev.find(t => t.id === coachRef.id);
        if (exists) {
          return prev.map(t => t.id === coachRef.id ? { ...t, ...shadowData } : t);
        }
        return [...prev, { id: coachRef.id, ...shadowData, leagueId: currentLeagueId } as any];
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `leagues/${currentLeagueId}/teams/${existingSlot?.id || 'new'}`);
    }
  };

  const handleDeleteShadow = async (slot: TeamAssignment) => {
    if (!currentLeagueId || !slot.id) return;
    
    if (!window.confirm(`Remove human claim from this slot? The coach persona will remain.`)) return;

    try {
      const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', slot.id);
      await updateDoc(teamRef, {
        isPlaceholder: false,
        ownerId: 'cpu',
        updatedAt: serverTimestamp()
      });

      setAllTeams(prev => prev.map(t => t.id === slot.id ? { 
        ...t, 
        isPlaceholder: false,
        ownerId: 'cpu'
      } : t));

      if (slot.ownerId && slot.ownerId !== 'cpu') {
        setMembers(prev => prev.map(m => m.id === slot.ownerId ? { ...m, team: undefined } : m));
      }
      
    } catch (error) {
      console.error("Error deleting shadow:", error);
      alert("Failed to delete shadow.");
    }
  };

  const handleHardResetSlot = async (slot: TeamAssignment) => {
    if (!currentLeagueId || !slot.id) return;
    
    if (!window.confirm(`HARD RESET: This will delete the staffing record for ${slot.name} (${slot.coachRole}). The coach persona will be unassigned but NOT deleted. Continue?`)) return;

    try {
      const batch = writeBatch(db);
      
      // 1. Unlink Coach Persona
      const coach = availableCoaches.find(c => c.teamId === slot.id);
      if (coach) {
        const coachRef = doc(db, 'coaches', coach.id);
        batch.update(coachRef, { teamId: null, updatedAt: serverTimestamp() });
      }

      // 2. Delete Team Document
      const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', slot.id);
      batch.delete(teamRef);

      await batch.commit();

      // Update local state
      setAllTeams(prev => prev.filter(t => t.id !== slot.id));
      if (coach) {
        setAvailableCoaches(prev => prev.map(c => c.id === coach.id ? { ...c, teamId: null } : c));
      }
      if (slot.ownerId && slot.ownerId !== 'cpu') {
        setMembers(prev => prev.map(m => m.id === slot.ownerId ? { ...m, team: undefined } : m));
      }
      
    } catch (error) {
      console.error("Error hard resetting slot:", error);
      alert("Failed to reset slot.");
    }
  };

  const handleGenerateInvite = async (slot: TeamAssignment) => {
    if (!currentLeagueId) return;
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', slot.id!);
      await updateDoc(teamRef, {
        inviteCode: code,
        updatedAt: serverTimestamp()
      });
      setAllTeams(prev => prev.map(t => t.id === slot.id ? { ...t, inviteCode: code } : t));
    } catch (error) {
      console.error("Error generating invite:", error);
    }
  };

  const handleRevokeInvite = async (slot: TeamAssignment) => {
    if (!currentLeagueId) return;
    try {
      const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', slot.id!);
      await updateDoc(teamRef, {
        inviteCode: deleteField(),
        updatedAt: serverTimestamp()
      });
      setAllTeams(prev => prev.map(t => t.id === slot.id ? { ...t, inviteCode: undefined } : t));
    } catch (error) {
      console.error("Error revoking invite:", error);
    }
  };

  const handleRepairData = async () => {
    if (!currentLeagueId) return;
    
    setSavingEdit(true);
    try {
      console.log("Starting league data repair...");
      
      // 1. Get all existing teams
      const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
      const teamsSnap = await getDocs(teamsRef);
      const existingTeamIds = new Set(teamsSnap.docs.map(d => d.id));
      
      // 2. Get all games to find orphaned IDs
      const gamesRef = collection(db, 'leagues', currentLeagueId, 'games');
      const gamesSnap = await getDocs(gamesRef);
      
      const orphanedTeams: Record<string, { name: string, school: string }> = {};
      
      gamesSnap.docs.forEach(doc => {
        const game = doc.data() as Game;
        if (game.homeTeamId && !existingTeamIds.has(game.homeTeamId)) {
          orphanedTeams[game.homeTeamId] = { 
            name: game.homeTeamName || 'Unknown', 
            school: game.homeTeamName || 'Unknown' 
          };
        }
        if (game.awayTeamId && !existingTeamIds.has(game.awayTeamId)) {
          orphanedTeams[game.awayTeamId] = { 
            name: game.awayTeamName || 'Unknown', 
            school: game.awayTeamName || 'Unknown' 
          };
        }
      });

      const orphanedCount = Object.keys(orphanedTeams).length;
      if (orphanedCount === 0) {
        alert("No orphaned data found. Your league records are intact.");
        setSavingEdit(false);
        return;
      }

      if (!window.confirm(`Found ${orphanedCount} missing team records referenced in your game history. Re-creating them will restore your stats and standings. Proceed?`)) {
        setSavingEdit(false);
        return;
      }

      let batch = writeBatch(db);
      let count = 0;

      for (const [teamId, data] of Object.entries(orphanedTeams)) {
        const schoolData = SCHOOLS.find(s => s.name === data.name);
        const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', teamId);
        
        batch.set(teamRef, {
          name: data.name,
          school: data.school,
          coachRole: 'HC',
          leagueId: currentLeagueId,
          ownerId: 'cpu',
          isPlaceholder: false,
          conference: schoolData?.conference || 'Independent',
          logoId: schoolData?.logoId || null,
          color: schoolData?.color || '#000000',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          wins: 0,
          losses: 0,
          confWins: 0,
          confLosses: 0
        });

        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      await batch.commit();
      alert(`Successfully restored ${orphanedCount} team records. Your standings and stats should now be visible again.`);
      
      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error("Error repairing data:", error);
      alert("Failed to repair data links.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRemoveAllShadows = async () => {
    if (!currentLeagueId) return;
    
    const shadowTeams = allTeams.filter(t => t.isPlaceholder);
    if (shadowTeams.length === 0) {
      alert("No shadow coaches found.");
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ALL ${shadowTeams.length} shadow coaches? This will revert them to CPU status. Coach personas will remain.`)) return;
    
    setSavingEdit(true);
    try {
      let batch = writeBatch(db);
      let count = 0;

      for (const team of shadowTeams) {
        const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', team.id!);
        batch.update(teamRef, {
          isPlaceholder: false,
          ownerId: 'cpu',
          updatedAt: serverTimestamp()
        });
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      setAllTeams(prev => prev.map(t => t.isPlaceholder ? { ...t, isPlaceholder: false, ownerId: 'cpu' } : t));
      alert(`Successfully removed ${shadowTeams.length} shadow coaches.`);
    } catch (error) {
      console.error("Error removing shadows:", error);
      alert("Failed to remove shadow coaches.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleGlobalReset = async () => {
    if (!currentLeagueId) {
      console.error("No current league ID found for reset.");
      alert("Error: No league selected.");
      return;
    }
    
    setIsResetModalOpen(false);
    setSavingEdit(true);
    
    try {
      console.log("Starting global reset for league:", currentLeagueId);
      
      // 1. Get all data to reset
      const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
      const teamsSnap = await getDocs(teamsRef);
      console.log(`Found ${teamsSnap.size} team records to delete.`);
      
      const membersRef = collection(db, 'leagues', currentLeagueId, 'members');
      const membersSnap = await getDocs(membersRef);
      console.log(`Found ${membersSnap.size} member records to check.`);
      
      const coachesRef = collection(db, 'coaches');
      const coachesSnap = await getDocs(query(coachesRef, where('leagueId', '==', currentLeagueId)));
      console.log(`Found ${coachesSnap.size} coach personas to unassign.`);

      let batch = writeBatch(db);
      let count = 0;

      const commitBatch = async () => {
        if (count > 0) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      };

      // Unlink Coach Personas (Characters) - ONLY updates, NO deletions
      for (const coachDoc of coachesSnap.docs) {
        if (coachDoc.data().teamId) {
          batch.update(coachDoc.ref, { teamId: null, updatedAt: serverTimestamp() });
          count++;
          if (count >= 400) await commitBatch();
        }
      }

      // Clear Member Team Assignments
      for (const memberDoc of membersSnap.docs) {
        if (memberDoc.data().team) {
          batch.update(memberDoc.ref, { 
            team: deleteField(),
            updatedAt: serverTimestamp() 
          });
          count++;
          if (count >= 400) await commitBatch();
        }
      }

      // Reset Staffing Records (The "Chairs") - UPDATING instead of DELETING
      for (const teamDoc of teamsSnap.docs) {
        batch.update(teamDoc.ref, {
          coachName: null,
          firstName: null,
          lastName: null,
          ownerId: 'cpu',
          isPlaceholder: false,
          inviteCode: deleteField(),
          updatedAt: serverTimestamp()
        });
        count++;
        if (count >= 400) await commitBatch();
      }

      // Final commit
      await commitBatch();

      console.log("Global reset successful.");

      // Update local state
      setAllTeams([]);
      setAvailableCoaches(prev => prev.map(c => ({ ...c, teamId: null })));
      setMembers(prev => prev.map(m => ({ ...m, team: undefined })));
      
      alert("League staffing has been completely reset. All Coach Personas are now in the Unassigned Pool.");
    } catch (error) {
      console.error("Error resetting league:", error);
      alert("Failed to reset league staffing. Check console for details.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRemovePersona = async (slot: TeamAssignment) => {
    if (!currentLeagueId || !slot.id) return;
    
    if (!window.confirm(`Are you sure you want to remove the coach from ${slot.name}?`)) return;

    try {
      const batch = writeBatch(db);
      
      // 1. Find the coach persona linked to this team
      const coach = availableCoaches.find(c => c.teamId === slot.id);
      if (coach) {
        const coachRef = doc(db, 'coaches', coach.id);
        batch.update(coachRef, { 
          teamId: null, 
          updatedAt: serverTimestamp() 
        });
      }

      // 2. Update the team document to be vacant
      const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', slot.id);
      batch.update(teamRef, {
        coachName: null,
        firstName: null,
        lastName: null,
        ownerId: 'cpu',
        isPlaceholder: false,
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      // Update local state
      setAllTeams(prev => prev.map(t => t.id === slot.id ? { 
        ...t, 
        coachName: undefined, 
        firstName: undefined, 
        lastName: undefined,
        ownerId: 'cpu',
        isPlaceholder: false
      } : t));
      
      setAvailableCoaches(prev => prev.map(c => c.teamId === slot.id ? { ...c, teamId: null } : c));
      
    } catch (error) {
      console.error("Error removing persona:", error);
      alert("Failed to remove persona.");
    }
  };

  const handleAssignPersona = async (coach: CarouselCoach) => {
    if (!currentLeagueId || !selectedSlot) return;
    
    setAssigningPersona(true);
    try {
      const batch = writeBatch(db);
      const schoolData = SCHOOLS.find(s => s.name === selectedSlot.school);
      
      // 1. Find or create the team document
      let teamId = '';
      const existingTeam = allTeams.find(t => (t.name === selectedSlot.school || t.school === selectedSlot.school) && t.coachRole === selectedSlot.role);
      
      if (existingTeam) {
        teamId = existingTeam.id!;
      } else {
        const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
        const newTeamRef = doc(teamsRef);
        teamId = newTeamRef.id;
        
        batch.set(newTeamRef, {
          name: selectedSlot.school,
          school: selectedSlot.school,
          coachRole: selectedSlot.role,
          role: selectedSlot.role,
          leagueId: currentLeagueId,
          ownerId: 'cpu',
          isPlaceholder: false,
          conference: schoolData?.conference || 'Independent',
          logoId: schoolData?.logoId || null,
          color: schoolData?.color || '#000000',
          createdAt: serverTimestamp()
        });
      }

      // 2. Link coach to team
      const coachRef = doc(db, 'coaches', coach.id);
      batch.update(coachRef, {
        teamId: teamId,
        updatedAt: serverTimestamp()
      });

      // 3. Update team with coach name
      const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', teamId);
      batch.update(teamRef, {
        coachName: coach.name,
        firstName: coach.name.split(' ')[0],
        lastName: coach.name.split(' ').slice(1).join(' '),
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      // Update local state
      const updatedTeamData = {
        id: teamId,
        name: selectedSlot.school,
        school: selectedSlot.school,
        coachRole: selectedSlot.role as any,
        coachName: coach.name,
        isPlaceholder: false,
        ownerId: 'cpu',
        logoId: schoolData?.logoId,
        color: schoolData?.color
      };

      if (existingTeam) {
        setAllTeams(prev => prev.map(t => t.id === teamId ? { ...t, ...updatedTeamData } : t));
      } else {
        setAllTeams(prev => [...prev, updatedTeamData as any]);
      }

      setAvailableCoaches(prev => prev.map(c => c.id === coach.id ? { ...c, teamId: teamId } : c));
      
      setIsPersonaModalOpen(false);
      setSelectedSlot(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `leagues/${currentLeagueId}/teams/${selectedSlot?.school}/assign`);
    } finally {
      setAssigningPersona(false);
    }
  };

  const unassignedMembers = members.filter(m => !m.team);
  const filteredUnassigned = unassignedMembers.filter(m => 
    (m.displayName?.toLowerCase() || '').includes(linkSearch.toLowerCase()) ||
    (m.email?.toLowerCase() || '').includes(linkSearch.toLowerCase())
  );

  const filteredSchools = SCHOOLS.filter(s => {
    const isAlreadyAssigned = members.some(m => m.team?.school === s.name);
    const isShadowCoach = allTeams.some(sc => (sc.name === s.name || sc.school === s.name));
    const matchesSearch = (s.name?.toLowerCase() || '').includes(schoolSearch.toLowerCase()) ||
                         (s.conference?.toLowerCase() || '').includes(schoolSearch.toLowerCase());
    return matchesSearch && !isAlreadyAssigned && !isShadowCoach;
  }).slice(0, 5);

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

      {/* Tab Switcher */}
      <div className="flex p-1 bg-zinc-900/50 rounded-2xl border border-zinc-800 w-full sm:w-fit">
        <button
          onClick={() => setActiveTab('staffing')}
          className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
            activeTab === 'staffing' 
              ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <School size={14} />
          Staffing & Shadows
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
            activeTab === 'permissions' 
              ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Shield size={14} />
          Active Permissions
        </button>
      </div>

      {activeTab === 'staffing' ? (
        <div className="space-y-8">
          {/* Master Staffing Registry */}
          <section className="space-y-6">
            <div className="flex flex-col gap-6 mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'ALL', label: 'All Programs', icon: School },
                    { id: 'USER', label: 'User Managed', icon: UserCheck },
                    { id: 'CPU', label: 'CPU Only', icon: Ghost },
                    { id: 'VACANCY', label: 'Has Vacancy', icon: UserPlus },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setStaffingFilter(filter.id as any)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${
                        staffingFilter === filter.id 
                          ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-900/20' 
                          : 'bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      <filter.icon size={12} />
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input 
                    type="text"
                    placeholder="Search School, Coach, or Pilot..."
                    value={staffingSearch}
                    onChange={(e) => setStaffingSearch(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-600/50 focus:border-orange-600 transition-all font-bold"
                  />
                  {staffingSearch && (
                    <button 
                      onClick={() => setStaffingSearch('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-lg">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      Showing <span className="text-orange-500">{filteredStaffing.length}</span> of {staffingRegistry.length} Programs
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-zinc-600">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-zinc-700" />
                      CPU
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-orange-600" />
                      Shadow
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      Active
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRepairData}
                    disabled={savingEdit}
                    className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Restore missing team records from game history"
                  >
                    {savingEdit ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                    Repair Links
                  </button>
                  <button
                    onClick={handleRemoveAllShadows}
                    disabled={savingEdit}
                    className="px-3 py-1.5 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove all shadow coaches and revert them to CPU"
                  >
                    {savingEdit ? <Loader2 className="animate-spin" size={12} /> : <Trash2 size={12} />}
                    Remove Shadows
                  </button>
                  <button
                    onClick={() => setIsResetModalOpen(true)}
                    disabled={savingEdit}
                    className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingEdit ? <Loader2 className="animate-spin" size={12} /> : <X size={12} />}
                    Global Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              {filteredStaffing.length > 0 ? (
                filteredStaffing.map((program) => (
                <div 
                  key={program.school}
                  className={`bg-zinc-900/30 backdrop-blur-xl rounded-[24px] border transition-all duration-500 ${
                    program.isClaimed 
                      ? 'border-orange-600/30 shadow-[0_0_20px_rgba(234,88,12,0.1)]' 
                      : 'border-zinc-800/50'
                  } overflow-hidden`}
                >
                  {/* School Header */}
                  <div className={`p-4 border-b flex items-center justify-between ${
                    program.isClaimed ? 'bg-orange-600/5 border-orange-600/20' : 'bg-zinc-800/30 border-zinc-800/50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center p-1.5 border border-zinc-800">
                        <img 
                          src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${program.logoId}.png`} 
                          alt="" 
                          className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-black uppercase italic tracking-tight">{program.school}</h3>
                          {program.isClaimed && (
                            <span className="px-1.5 py-0.5 bg-orange-600 text-white text-[8px] font-black uppercase tracking-widest rounded shadow-lg shadow-orange-600/20">
                              CLAIMED
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Program Staffing</p>
                      </div>
                    </div>
                    <div className="px-3 py-1 bg-zinc-900/50 rounded-lg border border-zinc-800">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        {Object.values(program.slots).filter(s => getSlotStatus(s.slot) === 'ACTIVE').length}/3 Active
                      </span>
                    </div>
                  </div>

                  {/* Slots List */}
                  <div className="divide-y divide-zinc-800/30">
                    {['HC', 'OC', 'DC'].map((role) => {
                      const { slot, persona } = program.slots[role];
                      const status = getSlotStatus(slot);
                      const pilot = slot?.ownerId ? members.find(m => m.id === slot.ownerId) : null;
                      
                      // Priority: Slot name (if it's a shadow/active edit) > Persona name > Slot name (fallback)
                      const displayName = slot?.coachName || persona?.name || 'Vacant';

                      return (
                        <div key={role} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/20 transition-colors group">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-10 text-center">
                              <span className="text-xs font-black text-zinc-500 group-hover:text-zinc-400 transition-colors">{role}</span>
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <p className={`font-bold text-sm ${status === 'CPU' && displayName === 'Vacant' ? 'text-zinc-600 italic' : 'text-zinc-300'}`}>
                                  {displayName}
                                </p>
                                
                                {/* Badge Engine */}
                                {status === 'ACTIVE' && (
                                  <span 
                                    className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded border"
                                    style={{ 
                                      backgroundColor: `${program.color}20`, 
                                      color: program.color,
                                      borderColor: `${program.color}40`
                                    }}
                                  >
                                    ACTIVE
                                  </span>
                                )}
                                {status === 'SHADOW' && (
                                  <span className="px-2 py-0.5 bg-orange-600/10 text-orange-500 text-[8px] font-black uppercase tracking-widest rounded border border-orange-600/20">
                                    SHADOW
                                  </span>
                                )}
                                {status === 'CPU' && (
                                  <span className="px-2 py-0.5 bg-zinc-800 text-zinc-600 text-[8px] font-black uppercase tracking-widest rounded border border-zinc-700">
                                    CPU
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                                  {role === 'HC' ? 'Head Coach' : role === 'OC' ? 'Offensive Coordinator' : 'Defensive Coordinator'}
                                </p>
                                {pilot && (
                                  <>
                                    <span className="text-zinc-700">•</span>
                                    <p className="text-[10px] text-orange-500/60 font-black uppercase tracking-widest flex items-center gap-1">
                                      <Users size={10} className="text-orange-600/40" />
                                      Pilot: {pilot.systemName}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Shadow Management */}
                            {status === 'SHADOW' && slot && (
                              <div className="flex items-center gap-2">
                                {slot.inviteCode ? (
                                  <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1">
                                    <span className="text-[10px] font-black text-orange-500 tracking-widest">{slot.inviteCode}</span>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(slot.inviteCode!);
                                        alert("Invite code copied!");
                                      }}
                                      className="p-1 hover:text-white text-zinc-500 transition-colors"
                                      title="Copy Code"
                                    >
                                      <Copy size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleRevokeInvite(slot)}
                                      className="p-1 hover:text-red-500 text-zinc-500 transition-colors"
                                      title="Revoke Invite"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleGenerateInvite(slot)}
                                    className="px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:text-white hover:bg-orange-600 transition-all border border-zinc-700 flex items-center gap-1.5"
                                    title="Generate Join Invite"
                                  >
                                    <Mail size={14} />
                                    Invite
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setSelectedShadowCoach(slot);
                                    setIsLinkModalOpen(true);
                                  }}
                                  className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:text-orange-500 hover:bg-zinc-700 transition-all border border-zinc-700"
                                  title="Link to Account"
                                >
                                  <LinkIcon size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteShadow(slot)}
                                  className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:text-red-500 hover:bg-red-500/10 transition-all border border-zinc-700"
                                  title="Delete Shadow Claim"
                                >
                                  <Ghost size={16} />
                                </button>
                              </div>
                            )}

                            {/* Vacant / CPU Slot Actions */}
                            {status === 'CPU' && (
                              <div className="flex items-center gap-2">
                                {!persona ? (
                                  <button
                                    onClick={() => {
                                      setSelectedSlot({ school: program.school, role: role as 'HC' | 'OC' | 'DC' });
                                      setIsPersonaModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 bg-zinc-800 text-zinc-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:text-white hover:bg-orange-600 transition-all border border-zinc-700 flex items-center gap-1.5"
                                  >
                                    <UserPlus size={14} />
                                    Assign Persona
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleCreateShadow(program.school, role as 'HC' | 'OC' | 'DC', persona, slot)}
                                    disabled={program.isClaimed}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5 ${
                                      program.isClaimed
                                        ? 'bg-zinc-900 text-zinc-700 border-zinc-800 cursor-not-allowed opacity-50'
                                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white hover:bg-orange-600'
                                    }`}
                                    title={program.isClaimed ? `Program claimed by ${program.claimantName}` : 'Create Shadow Claim'}
                                  >
                                    <Ghost size={14} />
                                    {program.isClaimed ? 'Claimed' : 'Create Shadow'}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Active Slot Actions */}
                            {status === 'ACTIVE' && slot && (
                              <button
                                onClick={() => handleDeleteShadow(slot)}
                                className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:text-red-500 hover:bg-red-500/10 transition-all border border-zinc-700"
                                title="Unlink User (Revert to CPU)"
                              >
                                <Lock size={16} />
                              </button>
                            )}

                            {/* Common Edit/Fire Actions */}
                            {displayName !== 'Vacant' && (
                              <button
                                onClick={() => {
                                  if (slot?.isPlaceholder || status === 'CPU') {
                                    setEditingGhostCoach(slot || { 
                                      id: '', 
                                      name: program.school, 
                                      coachRole: role as 'HC' | 'OC' | 'DC',
                                      leagueId: currentLeagueId!,
                                      ownerId: 'cpu',
                                      isPlaceholder: false
                                    });
                                    setEditFirstName(displayName.split(' ')[0] || '');
                                    setEditLastName(displayName.split(' ').slice(1).join(' ') || '');
                                    setEditRole(role as 'HC' | 'OC' | 'DC');
                                    setEditSchool(program.school);
                                    setIsEditModalOpen(true);
                                  } else {
                                    const member = members.find(m => m.id === slot?.ownerId);
                                    if (member) handleOpenAssign(member);
                                  }
                                }}
                                className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:text-white hover:bg-zinc-700 transition-all border border-zinc-700"
                                title="Edit Staff"
                              >
                                <Settings2 size={16} />
                              </button>
                            )}
                            
                            {displayName !== 'Vacant' && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => slot && handleRemovePersona(slot)}
                                  className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:text-red-500 hover:bg-red-500/10 transition-all border border-zinc-700"
                                  title="Fire / Remove Coach"
                                >
                                  <X size={16} />
                                </button>
                                <button
                                  onClick={() => slot && handleHardResetSlot(slot)}
                                  className="p-2 bg-zinc-800 text-zinc-500 rounded-lg hover:text-white hover:bg-red-600 transition-all border border-zinc-700"
                                  title="Hard Reset Slot"
                                >
                                  <Loader2 size={16} className="rotate-45" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 rounded-[32px] border border-zinc-800/50 border-dashed"
                >
                  <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
                    <Search className="text-zinc-600" size={32} />
                  </div>
                  <h3 className="text-white font-black uppercase tracking-tighter text-xl italic">No matching programs found</h3>
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-2">Try adjusting your filters or search query</p>
                  <button 
                    onClick={() => {
                      setStaffingFilter('ALL');
                      setStaffingSearch('');
                    }}
                    className="mt-6 px-6 py-2 bg-zinc-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-700 transition-colors"
                  >
                    Clear All Filters
                  </button>
                </motion.div>
              )}
            </div>
          </section>
        </div>
      ) : (
        /* Active Permissions Tab */
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="text-zinc-500" size={20} />
            <h2 className="text-sm font-black text-zinc-500 uppercase tracking-widest italic">Active Members & Permissions</h2>
          </div>
          <div className="grid gap-4">
            {members.map((member) => (
              <div 
                key={member.id}
                className="bg-zinc-900/50 backdrop-blur-xl rounded-2xl p-6 border border-zinc-800 flex flex-col gap-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-500 border border-zinc-700">
                      <Users size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-lg leading-tight">
                          {member.systemName}
                          {member.displayName !== member.systemName && (
                            <span className="ml-2 text-xs text-zinc-500 font-medium">({member.displayName})</span>
                          )}
                        </h3>
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
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Role Selection */}
                    <div className="flex flex-col gap-1 min-w-[140px]">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                        <Shield size={10} />
                        System Role
                      </label>
                      <select 
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-orange-600/50 appearance-none cursor-pointer hover:border-zinc-600 transition-all"
                      >
                        <option value="owner">Owner</option>
                        <option value="commissioner">Commissioner</option>
                        <option value="player">User / Player</option>
                      </select>
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
                </div>

                {/* Permission Matrix */}
                <div className="pt-4 border-t border-zinc-800/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="text-zinc-600" size={14} />
                    <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Permission Matrix</h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { key: 'canEditSchedule', label: 'Schedule', icon: Calendar },
                      { key: 'canEditStandings', label: 'Standings', icon: BarChart3 },
                      { key: 'canManageMembers', label: 'Members', icon: Users },
                      { key: 'canEditPolls', label: 'Polls', icon: Trophy },
                      { key: 'canDeleteCoaches', label: 'Delete Personas', icon: Trash2 },
                      { key: 'canDeleteLeague', label: 'Delete League', icon: AlertCircle }
                    ].map((perm) => (
                      <button
                        key={perm.key}
                        onClick={() => handleUpdatePermission(member.id, perm.key, !member.permissions?.[perm.key as keyof typeof member.permissions])}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          member.permissions?.[perm.key as keyof typeof member.permissions]
                            ? 'bg-orange-600/10 border-orange-500/30 text-orange-500'
                            : 'bg-zinc-800/30 border-zinc-800 text-zinc-600 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <perm.icon size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">{perm.label}</span>
                        </div>
                        <div className={`w-3 h-3 rounded-full border-2 ${
                          member.permissions?.[perm.key as keyof typeof member.permissions]
                            ? 'bg-orange-500 border-orange-400'
                            : 'border-zinc-700'
                        }`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Persona Picker Modal */}
      <AnimatePresence>
        {isPersonaModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPersonaModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed inset-x-0 bottom-0 z-50 bg-zinc-900 rounded-t-[32px] border-t border-zinc-800 sm:max-w-lg sm:mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header - Sticky */}
              <div className="p-6 border-b border-zinc-800/50 shrink-0">
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white uppercase italic">Assign <span className="text-orange-600">Persona</span></h2>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                      {selectedSlot?.role} at {selectedSlot?.school}
                    </p>
                  </div>
                  <button onClick={() => setIsPersonaModalOpen(false)} className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 transition-all hover:text-white">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="space-y-6 pb-8">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search unassigned coaches..."
                      value={personaSearch}
                      onChange={(e) => setPersonaSearch(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                    />
                  </div>

                  <div className="grid gap-3">
                    {availableCoaches
                      .filter(c => !c.teamId && c.name.toLowerCase().includes(personaSearch.toLowerCase()))
                      .map(coach => (
                        <button
                          key={coach.id}
                          onClick={() => handleAssignPersona(coach)}
                          disabled={assigningPersona}
                          className="w-full bg-zinc-800/50 p-4 rounded-2xl border border-zinc-700 hover:border-orange-500/50 hover:bg-zinc-800 transition-all flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-600 border border-zinc-800">
                              <Users size={20} />
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-white group-hover:text-orange-500 transition-colors">{coach.name}</p>
                              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{coach.role}</p>
                            </div>
                          </div>
                          <ChevronRight size={18} className="text-zinc-600 group-hover:text-orange-500 transition-colors" />
                        </button>
                      ))}
                    
                    {availableCoaches.filter(c => !c.teamId).length === 0 && (
                      <div className="text-center py-12 bg-zinc-800/20 rounded-3xl border border-dashed border-zinc-800">
                        <Users className="mx-auto text-zinc-700 mb-3" size={32} />
                        <p className="text-zinc-500 font-bold italic">No unassigned personas available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Ghost Coach Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed inset-x-0 bottom-0 z-50 bg-zinc-900 rounded-t-[32px] border-t border-zinc-800 sm:max-w-lg sm:mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header - Sticky */}
              <div className="p-6 border-b border-zinc-800/50 shrink-0">
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white uppercase italic">Edit <span className="text-orange-600">Ghost Coach</span></h2>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Updating {editingGhostCoach?.coachName}</p>
                  </div>
                  <button onClick={() => setIsEditModalOpen(false)} className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 transition-all hover:text-white">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <form id="edit-ghost-form" onSubmit={(e) => { e.preventDefault(); handleEditGhostCoach(); }} className="space-y-6 pb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">First Name</label>
                      <input 
                        type="text" 
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Last Name</label>
                      <input 
                        type="text" 
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">School</label>
                    <input 
                      type="text" 
                      value={editSchool}
                      onChange={(e) => setEditSchool(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Coaching Role</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['HC', 'OC', 'DC'].map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setEditRole(role as 'HC' | 'OC' | 'DC')}
                          className={`py-3 rounded-xl font-black text-xs transition-all border ${
                            editRole === role 
                              ? 'bg-orange-600 border-orange-500 text-white' 
                              : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

              {/* Footer - Sticky */}
              <div className="p-6 border-t border-zinc-800/50 bg-zinc-900/50 backdrop-blur-md pb-12 sm:pb-6 shrink-0">
                <button
                  disabled={savingEdit}
                  type="submit"
                  form="edit-ghost-form"
                  className="w-full bg-white text-black font-black py-5 rounded-2xl shadow-xl shadow-white/5 hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                  SAVE CHANGES
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Global Reset Modal */}
      <AnimatePresence>
        {isResetModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsResetModalOpen(false)}
              className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-6 pointer-events-none"
            >
              <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-[32px] p-8 space-y-8 pointer-events-auto shadow-2xl shadow-red-900/20">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                  <X className="text-red-500" size={40} />
                </div>
                
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-black text-white uppercase italic">Global <span className="text-red-600">Reset</span></h2>
                  <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                    This will delete ALL staffing records and unassign ALL coaches across the entire league. 
                    <br />
                    <span className="text-zinc-500 font-bold mt-2 block">Coach Personas (Characters) will NOT be deleted, only unassigned.</span>
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleGlobalReset}
                    className="w-full bg-red-600 text-white font-black py-5 rounded-2xl hover:bg-red-500 transition-all active:scale-[0.98] shadow-xl shadow-red-600/20"
                  >
                    CONFIRM WIPE
                  </button>
                  <button
                    onClick={() => setIsResetModalOpen(false)}
                    className="w-full bg-zinc-800 text-zinc-400 font-black py-5 rounded-2xl hover:bg-zinc-700 transition-all active:scale-[0.98]"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
              className="fixed inset-x-0 bottom-0 z-50 bg-zinc-900 rounded-t-[32px] border-t border-zinc-800 sm:max-w-lg sm:mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header - Sticky */}
              <div className="p-6 border-b border-zinc-800/50 shrink-0">
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white uppercase italic">Link <span className="text-orange-600">Account</span></h2>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Linking {selectedShadowCoach?.coachName} ({selectedShadowCoach?.name})</p>
                  </div>
                  <button onClick={() => setIsLinkModalOpen(false)} className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 transition-all hover:text-white">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="space-y-6 pb-12">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search unassigned users..."
                      value={linkSearch}
                      onChange={(e) => setLinkSearch(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
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
              className="fixed inset-x-0 bottom-0 z-50 bg-zinc-900 rounded-t-[32px] border-t border-zinc-800 sm:max-w-lg sm:mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header - Sticky */}
              <div className="p-6 border-b border-zinc-800/50 shrink-0">
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-white uppercase italic">
                      {selectedUser?.team ? 'Manage' : 'Assign'} <span className="text-orange-600">Coach</span>
                    </h2>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
                      {selectedUser?.team ? 'Updating' : 'Assigning'} {selectedUser?.displayName}
                    </p>
                  </div>
                  <button onClick={() => setIsAssignModalOpen(false)} className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 transition-all hover:text-white">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <form id="assign-coach-form" onSubmit={(e) => { e.preventDefault(); handleAssign(); }} className="space-y-6 pb-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">First Name</label>
                      <input 
                        type="text" 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Last Name</label>
                      <input 
                        type="text" 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
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
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl pl-12 pr-4 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                      />
                    </div>
                    
                    {schoolSearch && (
                      <div className="mt-2 space-y-2">
                        {filteredSchools.map(school => (
                          <button
                            key={school.name}
                            type="button"
                            onClick={() => {
                              setSelectedSchool(school.name);
                              setSchoolSearch('');
                            }}
                            className="w-full flex items-center justify-between p-4 bg-zinc-800 border border-zinc-700 rounded-2xl hover:border-orange-600/50 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center p-1">
                                <img src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${school.logoId}.png`} alt="" className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" referrerPolicy="no-referrer" />
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
                      <button type="button" onClick={() => setSelectedSchool(null)} className="text-orange-500 text-[10px] font-black uppercase tracking-widest">Change</button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Coaching Role</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['HC', 'OC', 'DC'].map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setSelectedRole(role as 'HC' | 'OC' | 'DC')}
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
                </form>
              </div>

              {/* Footer - Sticky */}
              <div className="p-6 border-t border-zinc-800/50 bg-zinc-900/50 backdrop-blur-md pb-12 sm:pb-6 shrink-0">
                <button
                  disabled={assigning || !selectedSchool}
                  type="submit"
                  form="assign-coach-form"
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
