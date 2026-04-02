import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';
import { motion } from 'motion/react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { currentLeagueId, userRole, loading: leagueLoading } = useLeague();
  const location = useLocation();

  const loading = authLoading || leagueLoading;

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Calibrating Dynasty...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!currentLeagueId && location.pathname !== '/portal' && location.pathname !== '/join-league') {
    return <Navigate to="/portal" replace />;
  }

  if (currentLeagueId && userRole === 'Unassigned' && location.pathname !== '/request-team') {
    return <Navigate to="/request-team" replace />;
  }

  if (currentLeagueId && userRole !== 'Unassigned' && location.pathname === '/request-team') {
    return <Navigate to="/" replace />;
  }

  if (currentLeagueId && (location.pathname === '/portal' || location.pathname === '/join-league')) {
    return <Navigate to="/" replace />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
};

export default ProtectedRoute;
