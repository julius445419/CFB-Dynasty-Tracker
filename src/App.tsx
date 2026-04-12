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
import { LeagueSettings } from './pages/LeagueSettings';
import { Schools } from './components/Schools';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Portal } from './pages/Portal';
import { MyTeam } from './pages/MyTeam';
import { JoinLeague } from './pages/JoinLeague';
import { ClaimProfile } from './pages/ClaimProfile';
import { RequestTeam } from './pages/RequestTeam';
import { PendingRequests } from './pages/admin/PendingRequests';
import { MemberManagement } from './pages/admin/MemberManagement';
import AdminDashboard from './pages/admin/AdminDashboard';
import CreateShadowCoach from './pages/admin/CreateShadowCoach';
import MatchupHub from './pages/MatchupHub';
import ScheduleManagement from './pages/admin/ScheduleManagement';
import ManageCoaches from './pages/admin/ManageCoaches';
import { ManagePolls } from './pages/admin/ManagePolls';
import { BulkStatEntry } from './pages/admin/BulkStatEntry';
import { LabProvider } from './carousel-lab/LabContext';
import LabDashboard from './carousel-lab/LabDashboard';
import { Programs } from './pages/Programs';
import { Standings } from './pages/Standings';
import { StatLeaders } from './pages/StatLeaders';
import { SchoolHome } from './pages/SchoolHome';
import { LeagueHub } from './pages/LeagueHub';
import { Polls } from './pages/Polls';
import { MyBoard } from './pages/MyBoard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleGate } from './components/RoleGate';
import { ErrorBoundary } from './components/ErrorBoundary';

// --- Placeholder Components ---

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
    <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
    <p className="text-slate-500 max-w-xs text-center">This dynasty module is currently being calibrated for CFB 26 data structures.</p>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
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
              <Route path="/claim-profile" element={
                <ProtectedRoute>
                  <RoleGate allowedRoles={['User', 'Owner', 'Commissioner', 'Player', 'Unassigned']}>
                    <ClaimProfile />
                  </RoleGate>
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
                <Route index element={<Dashboard />} />
                <Route path="team" element={<MyTeam />} />
                <Route path="team/recruiting" element={<MyBoard />} />
                <Route path="teams/:teamId" element={<MyTeam />} />
                <Route path="league" element={<LeagueHub />} />
                <Route path="programs" element={<Programs />} />
                <Route path="standings" element={<Standings />} />
                <Route path="leaders" element={<StatLeaders />} />
                <Route path="matchups" element={<MatchupHub />} />
                <Route path="polls" element={<Polls />} />
                <Route path="school/:schoolId" element={<SchoolHome />} />
                <Route path="admin" element={
                  <RoleGate allowedRoles={['Owner', 'Commissioner']}>
                    <AdminDashboard />
                  </RoleGate>
                } />
                <Route path="admin/settings" element={<LeagueSettings />} />
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
                <Route path="admin/coaches" element={
                  <RoleGate allowedRoles={['Owner', 'Commissioner']}>
                    <ManageCoaches />
                  </RoleGate>
                } />
                <Route path="admin/schedule" element={
                  <RoleGate allowedRoles={['Owner', 'Commissioner']}>
                    <ScheduleManagement />
                  </RoleGate>
                } />
                <Route path="admin/polls" element={
                  <RoleGate allowedRoles={['Owner', 'Commissioner']}>
                    <ManagePolls />
                  </RoleGate>
                } />
                <Route path="admin/bulk-stats" element={
                  <RoleGate allowedRoles={['Owner', 'Commissioner']}>
                    <BulkStatEntry />
                  </RoleGate>
                } />
                <Route path="admin/lab" element={
                  <RoleGate allowedRoles={['Owner', 'Commissioner']}>
                    <LabProvider>
                      <LabDashboard />
                    </LabProvider>
                  </RoleGate>
                } />
                <Route path="*" element={<PlaceholderPage title="Not Found" />} />
              </Route>
            </Routes>
          </Router>
        </LeagueProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
