import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  User
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Chrome, 
  AlertCircle, 
  ChevronLeft,
  Trophy
} from 'lucide-react';

export const Login: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const syncUserProfile = async (user: User) => {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      displayName: user.displayName || user.email?.split('@')[0] || 'Unknown User',
      email: user.email,
      photoURL: user.photoURL,
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        await syncUserProfile(result.user);
      }
    } catch (err: any) {
      setError(err.message);
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setError(null);
    try {
      let result;
      if (isSignUp) {
        result = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        result = await signInWithEmailAndPassword(auth, email, password);
      }
      if (result.user) {
        await syncUserProfile(result.user);
      }
    } catch (err: any) {
      setError(err.message);
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setError('Password reset email sent!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden"
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
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="mx-auto h-20 w-20 rounded-3xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white shadow-2xl shadow-orange-600/20 mb-6"
          >
            <Trophy size={40} className="drop-shadow-lg" />
          </motion.div>
          <h2 className="text-4xl font-black text-white tracking-tight uppercase italic">
            Dynasty <span className="text-orange-600">Companion</span>
          </h2>
          <p className="mt-3 text-zinc-400 font-medium">The ultimate CFB 26 management platform</p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl rounded-[2.5rem] p-8 border border-zinc-800 shadow-2xl">
          <AnimatePresence mode="wait">
            {!isEmailMode ? (
              <motion.div
                key="social"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <button
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                  className="flex w-full items-center justify-center gap-4 rounded-2xl bg-white px-6 py-4 text-base font-bold text-zinc-950 shadow-xl hover:bg-zinc-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Chrome className="h-6 w-6" />
                  Continue with Google
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-widest">
                    <span className="bg-zinc-900/0 px-4 text-zinc-500 font-bold">Or use email</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsEmailMode(true)}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-zinc-800 px-6 py-4 text-base font-bold text-white hover:bg-zinc-700 transition-all active:scale-95"
                >
                  <Mail className="h-5 w-5" />
                  Sign in with Email
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <button 
                  onClick={() => setIsEmailMode(false)}
                  className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>

                <form onSubmit={handleEmailAuth} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                        placeholder="coach@dynasty.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                      <AlertCircle size={14} />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-orange-600 px-6 py-4 text-base font-bold text-white shadow-xl shadow-orange-600/20 hover:bg-orange-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSignUp ? 'Create Account' : 'Sign In'}
                    <ArrowRight size={20} />
                  </button>
                </form>

                <div className="flex flex-col gap-4 text-center">
                  <button 
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                  >
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                  </button>
                  {!isSignUp && (
                    <button 
                      onClick={handleForgotPassword}
                      className="text-zinc-500 hover:text-orange-500 text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em]">
          Version 1.0.0 • Built for CFB 26
        </p>
      </motion.div>
    </motion.div>
  );
};

export default Login;
