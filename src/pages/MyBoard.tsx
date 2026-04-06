import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, getDoc, writeBatch, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useLeague } from '../context/LeagueContext';
import { useAuth } from '../context/AuthContext';
import { Target } from '../types';
import { RecruitCard } from '../components/recruiting/RecruitCard';
import { ScoutingDrawer } from '../components/recruiting/ScoutingDrawer';
import { AddRecruitModal } from '../components/recruiting/AddRecruitModal';
import { ClipboardList, Loader2, Filter, Plus, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MyBoardProps {
  teamId?: string;
}

export const MyBoard: React.FC<MyBoardProps> = ({ teamId: propTeamId }) => {
  const { currentLeagueId, userTeam } = useLeague();
  const { user } = useAuth();
  const targetTeamId = propTeamId || userTeam?.id;
  const isOwner = !!userTeam && targetTeamId === userTeam.id;

  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [showSuccess, setShowSuccess] = useState(false);
  const [schoolName, setSchoolName] = useState<string>('');

  useEffect(() => {
    if (!currentLeagueId || !targetTeamId) return;

    setLoading(true);
    let isMounted = true;

    if (isOwner) {
      // Owner View: Fetch private targets
      const targetsRef = collection(db, 'leagues', currentLeagueId, 'teams', targetTeamId, 'targets');
      const unsubscribe = onSnapshot(targetsRef, (snapshot) => {
        const targetDocs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
        
        const joinData = async () => {
          try {
            const joinedData = await Promise.all(targetDocs.map(async (t: any) => {
              const pId = t.prospectId || t.id;
              const prospectRef = doc(db, 'leagues', currentLeagueId, 'prospects', pId);
              const prospectSnap = await getDoc(prospectRef);
              if (prospectSnap.exists()) {
                // Ensure target ID (t.id) takes precedence over any ID in prospect data
                return { ...prospectSnap.data(), ...t, id: t.id } as Target;
              }
              return { ...t, id: t.id } as Target;
            }));

            if (!isMounted) return;

            const priorityOrder: Record<string, number> = { 'Top Target': 0, 'High': 1, 'Med': 2, 'Low': 3 };
            joinedData.sort((a, b) => {
              const pA = priorityOrder[a.priority] ?? 4;
              const pB = priorityOrder[b.priority] ?? 4;
              if (pA !== pB) return pA - pB;
              return a.name.localeCompare(b.name);
            });
            
            setTargets(joinedData);
          } catch (err) {
            console.error("Error joining prospect data:", err);
          } finally {
            if (isMounted) setLoading(false);
          }
        };

        joinData();
      }, (err) => {
        console.error("Targets snapshot error:", err);
        if (isMounted) setLoading(false);
      });
      return () => {
        isMounted = false;
        unsubscribe();
      };
    } else {
      // Visitor View: Fetch only committed prospects from global pool
      const fetchVisitorData = async () => {
        try {
          const teamRef = doc(db, 'leagues', currentLeagueId, 'teams', targetTeamId);
          const teamSnap = await getDoc(teamRef);
          const currentSchoolName = teamSnap.exists() ? (teamSnap.data().school || teamSnap.data().name) : targetTeamId;
          if (isMounted) setSchoolName(currentSchoolName);

          const prospectsRef = collection(db, 'leagues', currentLeagueId, 'prospects');
          const q = query(prospectsRef, where('committedTo', '==', currentSchoolName));
          
          const viewerTargetsRef = userTeam?.id 
            ? collection(db, 'leagues', currentLeagueId, 'teams', userTeam.id, 'targets')
            : null;

          let committedData: any[] = [];
          let viewerScoutingData: Record<string, any> = {};

          const updateMerged = () => {
            if (!isMounted) return;
            const merged = committedData.map(p => {
              const vs = viewerScoutingData[p.id];
              return {
                ...p,
                scoutingStatus: vs?.scoutingStatus || 'Normal',
                priority: vs?.priority || 'Low',
                notes: vs?.notes || '',
                topSchools: vs?.topSchools || '',
                devTrait: vs?.devTrait || 'Unknown',
                visits: vs?.visits || '',
                scoutedRatings: vs?.scoutedRatings || {}
              } as Target;
            });
            setTargets(merged);
            setLoading(false);
          };

          const unsubProspects = onSnapshot(q, (snapshot) => {
            committedData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateMerged();
          });

          let unsubViewer = () => {};
          if (viewerTargetsRef) {
            unsubViewer = onSnapshot(viewerTargetsRef, (snapshot) => {
              viewerScoutingData = snapshot.docs.reduce((acc, doc) => {
                const data = doc.data();
                acc[data.prospectId || doc.id] = data;
                return acc;
              }, {} as Record<string, any>);
              updateMerged();
            });
          } else {
            updateMerged();
          }

          return () => {
            unsubProspects();
            unsubViewer();
          };
        } catch (err) {
          console.error("Error fetching visitor board:", err);
          if (isMounted) setLoading(false);
        }
      };
      
      let unsub: any;
      fetchVisitorData().then(u => unsub = u);
      return () => {
        isMounted = false;
        unsub?.();
      };
    }
  }, [currentLeagueId, targetTeamId, isOwner, userTeam?.id]);

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType: operation,
      path,
      authInfo: {
        userId: user?.uid,
        email: user?.email,
        emailVerified: user?.emailVerified,
        isAnonymous: user?.isAnonymous,
      }
    };
    console.error(`Firestore Error [${operation}]:`, JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const handleUpdateStatus = async (id: string, status: 'Normal' | 'Gem' | 'Bust') => {
    if (!currentLeagueId || !userTeam) return;
    
    const targetRef = doc(db, 'leagues', currentLeagueId, 'teams', userTeam.id, 'targets', id);
    const previousTargets = [...targets];
    setTargets(prev => prev.map(t => t.id === id ? { ...t, scoutingStatus: status } : t));

    try {
      await updateDoc(targetRef, { scoutingStatus: status, updatedAt: serverTimestamp() });
    } catch (error) {
      setTargets(previousTargets);
      handleFirestoreError(error, 'update', targetRef.path);
    }
  };

  const handleUpdatePriority = async (id: string, priority: 'Low' | 'Med' | 'High' | 'Top Target') => {
    if (!currentLeagueId || !userTeam) return;

    const targetRef = doc(db, 'leagues', currentLeagueId, 'teams', userTeam.id, 'targets', id);
    const previousTargets = [...targets];
    setTargets(prev => prev.map(t => t.id === id ? { ...t, priority } : t));

    try {
      await updateDoc(targetRef, { priority, updatedAt: serverTimestamp() });
    } catch (error) {
      setTargets(previousTargets);
      handleFirestoreError(error, 'update', targetRef.path);
    }
  };

  const handleRemove = async (id: string) => {
    if (!currentLeagueId || !userTeam) {
      console.error("Cannot remove: missing leagueId or userTeam", { currentLeagueId, userTeamId: userTeam?.id });
      return;
    }
    
    const targetRef = doc(db, 'leagues', currentLeagueId, 'teams', userTeam.id, 'targets', id);
    console.log(`Attempting to remove target. Path: ${targetRef.path}, ID: ${id}`);
    
    const previousTargets = [...targets];
    
    // Optimistic update
    setTargets(prev => prev.filter(t => t.id !== id));

    try {
      await deleteDoc(targetRef);
      console.log(`Successfully deleted target document: ${id}`);
    } catch (error: any) {
      console.error(`Failed to delete target document: ${id}. Error: ${error.message}`, error);
      setTargets(previousTargets);
      
      // If it's a permission error, it might be because the path is wrong or rules are too strict
      if (error.code === 'permission-denied') {
        console.error("Permission denied. Check if you are the owner of this team and if the path is correct.");
      }
      
      handleFirestoreError(error, 'delete', targetRef.path);
    }
  };

  const handleSaveScouting = async (id: string, data: Partial<Target>, globalData: { commitStatus?: string, committedTo?: string }) => {
    if (!currentLeagueId || !userTeam) return;
    
    const target = targets.find(t => t.id === id);
    if (!target) return;

    // Use prospectId if available, otherwise fallback to id (which might be the prospectId in legacy data)
    const pId = target.prospectId || target.id;
    const batch = writeBatch(db);
    const targetRef = doc(db, 'leagues', currentLeagueId, 'teams', userTeam.id, 'targets', id);
    const prospectRef = doc(db, 'leagues', currentLeagueId, 'prospects', pId);

    // Update Private Target Record
    const { id: _, ...targetData } = data; // Ensure we don't save 'id' field into document data
    batch.update(targetRef, {
      ...targetData,
      updatedAt: serverTimestamp()
    });

    // Update Global Prospect Record ONLY if data is provided
    if (globalData && Object.keys(globalData).length > 0) {
      batch.update(prospectRef, {
        ...globalData,
        committedByUserId: user?.uid || '',
        updatedAt: serverTimestamp()
      });

      // Log Activity if committed
      if (globalData.commitStatus === 'Committed to My School' || globalData.commitStatus === 'Committed Elsewhere') {
        const activityRef = collection(db, 'leagues', currentLeagueId, 'activity_logs');
        const teamName = globalData.committedTo || userTeam?.name || 'a school';
        const stars = target.stars ? `${target.stars}-Star ` : '';
        const activityDoc = {
          leagueId: currentLeagueId,
          type: 'recruiting_commit',
          title: 'Prospect Committed',
          description: `${stars}${target.pos} ${target.name} has committed to ${teamName}`,
          timestamp: serverTimestamp(),
          metadata: {
            prospectId: pId,
            teamId: userTeam?.id,
            isHumanInvolved: globalData.commitStatus === 'Committed to My School'
          }
        };
        // We can't add to batch easily with addDoc, but we can use doc() with auto-id
        const newActivityRef = doc(activityRef);
        batch.set(newActivityRef, activityDoc);
      }
    }

    try {
      await batch.commit();
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsDrawerOpen(false);
      }, 1500);
    } catch (error) {
      handleFirestoreError(error, 'write_batch', `target:${targetRef.path}, prospect:${prospectRef.path}`);
    }
  };

  const filteredTargets = targets.filter(t => priorityFilter === 'All' || t.priority === priorityFilter);

  return (
    <div className="space-y-6 pb-24 p-4 sm:p-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tight">
            {isOwner ? 'The Big Board' : 'Committed Prospects'}
          </h1>
          <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">
            {isOwner ? "Your team's private recruiting war room" : `Public commitments for this school`}
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-orange-700 transition-all active:scale-95 shadow-lg shadow-orange-600/20"
            >
              <Plus size={14} /> Add Target
            </button>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
              <Filter size={14} className="text-zinc-500" />
              <select 
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase tracking-widest text-white outline-none cursor-pointer"
              >
                <option value="All">All Priorities</option>
                <option value="Top Target">Top Targets</option>
                <option value="High">High Priority</option>
                <option value="Med">Med Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>
          </div>
        )}
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="text-orange-600 animate-spin" size={40} />
          <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Loading Board...</p>
        </div>
      ) : filteredTargets.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredTargets.map(target => (
            <RecruitCard 
              key={target.id}
              recruit={target}
              isTarget={isOwner}
              onUpdateStatus={isOwner ? handleUpdateStatus : undefined}
              onUpdatePriority={isOwner ? handleUpdatePriority : undefined}
              onRemove={isOwner ? handleRemove : undefined}
              onClick={isOwner ? (t) => {
                setSelectedTarget(t as Target);
                setIsDrawerOpen(true);
              } : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
            <ClipboardList className="text-zinc-700" size={32} />
          </div>
          <h3 className="text-xl font-black text-white uppercase italic mb-2">
            {isOwner ? 'Your Board is Empty' : 'No Committed Prospects'}
          </h3>
          <p className="text-zinc-500 text-sm max-w-xs mb-6">
            {isOwner 
              ? 'Add your first recruit to start building your recruiting class.' 
              : `This school hasn't secured any commitments yet.`}
          </p>
          {isOwner && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-orange-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-orange-600/20 active:scale-95 transition-transform"
            >
              Add Target
            </button>
          )}
        </div>
      )}

      {isOwner && userTeam && (
        <AddRecruitModal 
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          leagueId={currentLeagueId!}
          teamId={userTeam.id}
        />
      )}

      <ScoutingDrawer 
        target={selectedTarget}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSave={handleSaveScouting}
        isOwner={isOwner}
      />

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 shadow-2xl shadow-green-600/40 border border-green-500"
          >
            <CheckCircle2 size={16} />
            Recruit Profile Saved Successfully
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
