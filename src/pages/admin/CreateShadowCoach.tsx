import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, 
  Search, 
  School, 
  ChevronRight, 
  X, 
  Check, 
  Loader2,
  ArrowLeft,
  ShieldAlert
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  collection, 
  addDoc, 
  updateDoc,
  doc,
  serverTimestamp, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { SCHOOLS } from '../../constants/schools';

const CreateShadowCoach: React.FC = () => {
  const { currentLeagueId } = useLeague();
  const navigate = useNavigate();
  
  const [coachName, setCoachName] = useState('');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<typeof SCHOOLS[0] | null>(null);
  const [selectedRole, setSelectedRole] = useState<'HC' | 'OC' | 'DC'>('HC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const filteredSchools = SCHOOLS.filter(s => 
    (s.name?.toLowerCase() || '').includes(schoolSearch.toLowerCase()) ||
    (s.conference?.toLowerCase() || '').includes(schoolSearch.toLowerCase())
  ).slice(0, 5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLeagueId || !selectedSchool || !coachName) return;

    setLoading(true);
    setError(null);

    try {
      // Check if school is already assigned
      const teamsRef = collection(db, 'leagues', currentLeagueId, 'teams');
      const q = query(teamsRef, where('name', '==', selectedSchool.name));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const existingTeam = querySnapshot.docs[0].data();
        // Only block if it's a real user (not CPU and not already a placeholder)
        if (existingTeam.ownerId && existingTeam.ownerId !== 'cpu') {
          throw new Error(`${selectedSchool.name} is already assigned to a coach.`);
        }

        // If it's a CPU team, update it to be a shadow coach
        if (existingTeam.ownerId === 'cpu') {
          const teamDocRef = doc(db, 'leagues', currentLeagueId, 'teams', querySnapshot.docs[0].id);
          await updateDoc(teamDocRef, {
            coachName: coachName,
            coachRole: selectedRole,
            ownerId: null,
            isPlaceholder: true,
            assignmentStatus: 'Active',
            updatedAt: serverTimestamp()
          });

          setSuccess(true);
          setTimeout(() => navigate('/admin/members'), 2000);
          return;
        }
        
        // If it's already a placeholder, we might want to update it or block it
        // For now, let's block it if it's already a placeholder to avoid confusion
        if (existingTeam.isPlaceholder) {
          throw new Error(`${selectedSchool.name} already has a shadow coach.`);
        }
      }

      // Create Shadow Coach (Team document with isPlaceholder: true)
      await addDoc(collection(db, 'leagues', currentLeagueId, 'teams'), {
        name: selectedSchool.name,
        coachName: coachName,
        coachRole: selectedRole,
        leagueId: currentLeagueId,
        ownerId: null, // No real user yet
        isPlaceholder: true,
        conference: selectedSchool.conference,
        logoId: selectedSchool.logoId,
        color: selectedSchool.color,
        assignmentStatus: 'Active',
        contractStart: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      setSuccess(true);
      setTimeout(() => navigate('/admin/members'), 2000);
    } catch (err: any) {
      console.error("Error creating shadow coach:", err);
      setError(err.message || "Failed to create shadow coach.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
          <Check className="text-green-500 w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase italic">Shadow Coach Created!</h2>
        <p className="text-zinc-500 font-medium">Redirecting to member management...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 pb-24">
      <header className="flex items-center gap-4">
        <Link to="/admin" className="p-2 bg-zinc-900 rounded-xl text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tight">
            Create <span className="text-orange-600">Shadow Coach</span>
          </h1>
          <p className="text-sm text-zinc-500 font-medium">Add a placeholder for a human coach who hasn't joined yet.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-[32px] p-8 space-y-6">
          {/* Coach Name */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Coach Name</label>
            <input 
              type="text" 
              placeholder="e.g. Coach Prime"
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              required
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-4 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50"
            />
          </div>

          {/* School Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Select School</label>
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
            
            <AnimatePresence>
              {schoolSearch && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-2 space-y-2"
                >
                  {filteredSchools.map(school => (
                    <button
                      key={school.name}
                      type="button"
                      onClick={() => {
                        setSelectedSchool(school);
                        setSchoolSearch('');
                      }}
                      className="w-full flex items-center justify-between p-4 bg-zinc-800 border border-zinc-700 rounded-2xl hover:border-orange-600/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center p-1">
                          <img 
                            src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${school.logoId}.png`} 
                            alt="" 
                            className="w-full h-full object-contain" 
                            referrerPolicy="no-referrer" 
                          />
                        </div>
                        <div className="text-left">
                          <p className="text-white font-bold text-sm">{school.name}</p>
                          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{school.conference}</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-zinc-600" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {selectedSchool && (
            <div className="p-4 bg-orange-600/10 border border-orange-600/20 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <School className="text-orange-500" size={20} />
                <div>
                  <p className="text-white font-bold">{selectedSchool.name}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase">{selectedSchool.conference}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedSchool(null)} 
                className="text-orange-500 text-[10px] font-black uppercase tracking-widest"
              >
                Change
              </button>
            </div>
          )}

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Coaching Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(['HC', 'OC', 'DC'] as const).map(role => (
                <button
                  key={role}
                  type="button"
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

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm font-bold">
              <ShieldAlert size={20} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedSchool || !coachName}
            className="w-full bg-white text-black font-black py-5 rounded-2xl shadow-xl shadow-white/5 hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
            CREATE SHADOW COACH
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateShadowCoach;
