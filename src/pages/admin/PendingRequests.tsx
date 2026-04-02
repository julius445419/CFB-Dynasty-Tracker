import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  deleteDoc, 
  setDoc, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check, 
  X, 
  User, 
  School, 
  Shield, 
  Clock, 
  AlertCircle,
  Inbox
} from 'lucide-react';

interface TeamRequest {
  id: string;
  userId: string;
  userEmail: string;
  firstName: string;
  lastName: string;
  school: string;
  logoId?: string | number;
  role: string;
  createdAt: any;
}

export const PendingRequests: React.FC = () => {
  const { currentLeagueId } = useLeague();
  const [requests, setRequests] = useState<TeamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentLeagueId) return;

    const requestsRef = collection(db, 'leagues', currentLeagueId, 'requests');
    const q = query(requestsRef, where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeamRequest[];
      setRequests(reqs.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentLeagueId]);

  const handleApprove = async (request: TeamRequest) => {
    if (!currentLeagueId) return;
    setProcessingId(request.id);

    try {
      const batch = writeBatch(db);

      // 1. Create Coach document in the league
      const coachRef = doc(db, 'leagues', currentLeagueId, 'teams', request.userId);
      batch.set(coachRef, {
        ownerId: request.userId,
        ownerEmail: request.userEmail,
        firstName: request.firstName,
        lastName: request.lastName,
        school: request.school,
        logoId: request.logoId || null,
        role: request.role,
        joinedAt: serverTimestamp(),
      });

      // 2. Delete the request
      const requestRef = doc(db, 'leagues', currentLeagueId, 'requests', request.id);
      batch.delete(requestRef);

      await batch.commit();
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Failed to approve request. Check console for details.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!currentLeagueId) return;
    if (!window.confirm("Are you sure you want to reject this request?")) return;
    
    setProcessingId(requestId);
    try {
      const requestRef = doc(db, 'leagues', currentLeagueId, 'requests', requestId);
      await deleteDoc(requestRef);
    } catch (error) {
      console.error("Error rejecting request:", error);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">
            Pending <span className="text-orange-600">Requests</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium">Review and approve new coaches joining your dynasty</p>
        </div>
        <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
          {requests.length} Total
        </div>
      </header>

      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {requests.length > 0 ? (
            requests.map((request) => (
              <motion.div
                key={request.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                    <User size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-900 text-lg leading-tight">
                      {request.firstName} {request.lastName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1">
                        <School size={14} className="text-orange-500" />
                        {request.school}
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield size={14} className="text-blue-500" />
                        {request.role}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} className="text-slate-400" />
                        {request.createdAt?.toDate().toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">{request.userEmail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 md:shrink-0">
                  <button
                    onClick={() => handleReject(request.id)}
                    disabled={processingId === request.id}
                    className="flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <X size={18} />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(request)}
                    disabled={processingId === request.id}
                    className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-orange-600 text-white text-sm font-bold shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {processingId === request.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    ) : (
                      <Check size={18} />
                    )}
                    Approve
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 bg-slate-100/50 rounded-[2.5rem] border-2 border-dashed border-slate-200"
            >
              <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm mb-4">
                <Inbox size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No Pending Requests</h3>
              <p className="text-slate-500 text-sm">All coach applications have been processed.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PendingRequests;
