import React from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate,
  useNavigate
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LeagueProvider, useLeague } from './context/LeagueContext';
import { AppLayout } from './components/AppLayout';
import { LeagueConfig } from './components/LeagueConfig';
import { Schools } from './components/Schools';
import { Login } from './pages/Login';
import { Portal } from './pages/Portal';
import { MyTeam } from './pages/MyTeam';
import { JoinLeague } from './pages/JoinLeague';
import { RequestTeam } from './pages/RequestTeam';
import { PendingRequests } from './pages/admin/PendingRequests';
import { MemberManagement } from './pages/admin/MemberManagement';
import AdminDashboard from './pages/admin/AdminDashboard';
import CreateShadowCoach from './pages/admin/CreateShadowCoach';
import MatchupHub from './pages/MatchupHub';
import ScheduleManagement from './pages/admin/ScheduleManagement';
import { NationalHub } from './pages/NationalHub';
import { Standings } from './pages/Standings';
import { StatLeaders } from './pages/StatLeaders';
import { MyBoard } from './pages/MyBoard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleGate } from './components/RoleGate';

// --- Placeholder Components ---

const Home = () => {
  const { user } = useAuth();
  const { leagueInfo } = useLeague();
  return (
    <div className="space-y-8 p-6">
      <header>
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tight">
          Welcome back, <span className="text-orange-600">{user?.displayName?.split(' ')[0] || 'Coach'}!</span>
        </h1>
        <p className="text-zinc-500 font-medium">Managing <span className="text-white font-bold">{leagueInfo?.name}</span></p>
      </header>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-[2rem] bg-zinc-900/50 backdrop-blur-xl p-8 border border-zinc-800 shadow-xl">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Active Season</h3>
          <p className="text-4xl font-black text-white italic">{leagueInfo?.currentYear || 2024}</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="px-2 py-1 bg-orange-600/10 text-orange-500 text-[10px] font-black rounded uppercase tracking-widest border border-orange-600/20">
              WEEK {leagueInfo?.currentWeek || 1}
            </span>
            <span className="px-2 py-1 bg-green-600/10 text-green-500 text-[10px] font-black rounded uppercase tracking-widest border border-green-600/20">
              ACTIVE
            </span>
          </div>
        </div>
        
        <div className="rounded-[2rem] bg-zinc-900/50 backdrop-blur-xl p-8 border border-zinc-800 shadow-xl">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">User Coaches</h3>
          <p className="text-4xl font-black text-white italic">12 / 32</p>
          <div className="mt-4">
            <span className="px-2 py-1 bg-blue-600/10 text-blue-500 text-[10px] font-black rounded uppercase tracking-widest border border-blue-600/20">
              ALL USERS ADVANCED
            </span>
          </div>
        </div>

        <div className="rounded-[2rem] bg-zinc-900/50 backdrop-blur-xl p-8 border border-zinc-800 shadow-xl">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Stat Records</h3>
          <p className="text-4xl font-black text-white italic">1,248</p>
          <div className="mt-4">
            <span className="px-2 py-1 bg-zinc-800 text-zinc-500 text-[10px] font-black rounded uppercase tracking-widest border border-zinc-700">
              TRACKING ENABLED
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
    <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
    <p className="text-slate-500 max-w-xs text-center">This dynasty module is currently being calibrated for CFB 26 data structures.</p>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <LeagueProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/portal" element={
              <ProtectedRoute>
                <Portal />
              </ProtectedRoute>
            } />
            <Route path="/join-league" element={
              <ProtectedRoute>
                <JoinLeague />
              </ProtectedRoute>
            } />
            <Route path="/request-team" element={
              <ProtectedRoute>
                <RequestTeam />
              </ProtectedRoute>
            } />
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Home />} />
              <Route path="team" element={<MyTeam />} />
              <Route path="team/recruiting" element={<MyBoard />} />
              <Route path="teams/:teamId" element={<MyTeam />} />
              <Route path="national-hub" element={<NationalHub />} />
              <Route path="standings" element={<Standings />} />
              <Route path="leaders" element={<StatLeaders />} />
              <Route path="matchups" element={<MatchupHub />} />
              <Route path="admin" element={
                <RoleGate allowedRoles={['Owner', 'Commissioner']}>
                  <AdminDashboard />
                </RoleGate>
              } />
              <Route path="admin/members" element={
                <RoleGate allowedRoles={['Owner', 'Commissioner']}>
                  <MemberManagement />
                </RoleGate>
              } />
              <Route path="admin/shadow-coaches" element={
                <RoleGate allowedRoles={['Owner', 'Commissioner']}>
                  <CreateShadowCoach />
                </RoleGate>
              } />
              <Route path="admin/requests" element={
                <RoleGate allowedRoles={['Owner', 'Commissioner']}>
                  <PendingRequests />
                </RoleGate>
              } />
              <Route path="admin/schedule" element={
                <RoleGate allowedRoles={['Owner', 'Commissioner']}>
                  <ScheduleManagement />
                </RoleGate>
              } />
              <Route path="*" element={<PlaceholderPage title="Not Found" />} />
            </Route>
          </Routes>
        </Router>
      </LeagueProvider>
    </AuthProvider>
  );
}
