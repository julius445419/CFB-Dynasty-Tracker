import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  User, 
  ChevronDown, 
  Check, 
  AlertCircle, 
  Send,
  LogOut,
  School as SchoolIcon
} from 'lucide-react';
import { SCHOOLS, School } from '../constants/schools';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export const RequestTeam: React.FC = () => {
  const { user } = useAuth();
  const { currentLeagueId, userRole } = useLeague();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'HC' | 'OC' | 'DC'>('HC');
  const [schoolSearch, setSchoolSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Filter schools based on search
  const filteredSchools = useMemo(() => {
    if (!schoolSearch) return SCHOOLS;
    return SCHOOLS.filter(s => 
      (s.name?.toLowerCase() || '').includes(schoolSearch.toLowerCase())
    );
  }, [schoolSearch]);

  // Redirect if already assigned
  React.useEffect(() => {
    if (userRole !== 'Unassigned' && currentLeagueId) {
      navigate('/', { replace: true });
    }
  }, [userRole, currentLeagueId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentLeagueId || !selectedSchool) return;

    setLoading(true);
    setError(null);

    try {
      const requestRef = doc(db, 'leagues', currentLeagueId, 'requests', user.uid);
      await setDoc(requestRef, {
        userId: user.uid,
        userEmail: user.email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        school: selectedSchool.name,
        logoId: selectedSchool.logoId || null,
        role,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    navigate('/login');
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl rounded-[2.5rem] p-8 border border-zinc-800 text-center space-y-6"
        >
          <div className="mx-auto h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
            <Check size={40} />
          </div>
          <h2 className="text-2xl font-black text-white uppercase italic">Request Sent!</h2>
          <p className="text-zinc-400">Your request to lead <span className="text-white font-bold">{selectedSchool.name}</span> has been submitted. A commissioner will review it shortly.</p>
          <button 
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors pt-4"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 relative overflow-hidden"
    >
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 relative z-10"
      >
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-orange-500 shadow-xl mb-6">
            <User size={32} />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight uppercase italic">
            Create <span className="text-orange-600">Coach</span>
          </h2>
          <p className="mt-2 text-zinc-400 font-medium">Claim your identity in this dynasty</p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl rounded-[2.5rem] p-8 border border-zinc-800 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all font-bold"
                  placeholder="e.g. Nick"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all font-bold"
                  placeholder="e.g. Saban"
                />
              </div>
            </div>

            {/* School Selection (Searchable Dropdown) */}
            <div className="space-y-2 relative">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Desired School</label>
              <div 
                className="relative cursor-pointer"
                onClick={() => setIsSchoolDropdownOpen(!isSchoolDropdownOpen)}
              >
                <SchoolIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <div className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl pl-12 pr-10 py-4 text-white font-bold min-h-[58px] flex items-center">
                  {selectedSchool?.name || <span className="text-zinc-500 font-normal">Select a school...</span>}
                </div>
                <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-transform ${isSchoolDropdownOpen ? 'rotate-180' : ''}`} size={18} />
              </div>

              <AnimatePresence>
                {isSchoolDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-50 left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
                  >
                    <div className="p-3 border-b border-zinc-800 sticky top-0 bg-zinc-900">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                        <input 
                          type="text"
                          autoFocus
                          placeholder="Search schools..."
                          value={schoolSearch}
                          onChange={(e) => setSchoolSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-600/50"
                        />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                      {filteredSchools.length > 0 ? (
                        filteredSchools.map((school) => (
                          <button
                            key={school.name}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSchool(school);
                              setIsSchoolDropdownOpen(false);
                              setSchoolSearch('');
                            }}
                            className="w-full text-left px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-orange-600 hover:text-white transition-colors flex items-center justify-between"
                          >
                            {school.name}
                            {selectedSchool?.name === school.name && <Check size={14} />}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-zinc-500 text-xs">No schools found</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Coaching Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(['HC', 'OC', 'DC'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-3 rounded-xl text-xs font-black transition-all border ${
                      role === r 
                        ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' 
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !selectedSchool}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-orange-600 px-6 py-5 text-lg font-black text-white shadow-xl shadow-orange-600/20 hover:bg-orange-700 transition-all active:scale-95 disabled:opacity-50 uppercase italic tracking-wider"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
              <Send size={20} />
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-zinc-800 flex flex-col items-center gap-4">
            <p className="text-zinc-500 text-xs font-medium">Wait for approval or <button onClick={handleLogout} className="text-zinc-300 underline">Switch Account</button></p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default RequestTeam;
