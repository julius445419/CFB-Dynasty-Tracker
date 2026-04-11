import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Calendar, Shield, ChevronRight, Trophy, Database, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, getDocs, query, where, addDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { SCHOOLS } from '../../constants/schools';
import { useLeague } from '../../context/LeagueContext';

const AdminDashboard: React.FC = () => {
  const { leagueInfo } = useLeague();
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });

  const isGlobalAdmin = auth.currentUser?.email === 'julius445419@gmail.com';

  const seedFCSTeams = async () => {
    setIsSeeding(true);
    setSeedStatus({ type: 'idle', message: 'Checking for existing FCS teams...' });
    
    try {
      const fcsTeams = SCHOOLS.filter(s => s.isFCS);
      let addedCount = 0;
      let skippedCount = 0;

      for (const team of fcsTeams) {
        const q = query(collection(db, 'teams'), where('name', '==', team.name));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          await addDoc(collection(db, 'teams'), {
            name: team.name,
            logoId: team.logoId,
            logoUrl: team.logoId,
            conference: team.conference,
            color: team.color,
            isFCS: true,
            createdAt: new Date().toISOString()
          });
          addedCount++;
        } else {
          skippedCount++;
        }
      }

      setSeedStatus({ 
        type: 'success', 
        message: `Seeding complete! Added ${addedCount} teams, skipped ${skippedCount} existing teams.` 
      });
    } catch (error: any) {
      console.error('Seeding error:', error);
      const errorMessage = error?.message || 'Unknown error';
      setSeedStatus({ type: 'error', message: `Failed to seed FCS teams: ${errorMessage}` });
    } finally {
      setIsSeeding(false);
    }
  };

  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });

  const migrateFCSLogos = async () => {
    setIsMigrating(true);
    setMigrationStatus({ type: 'idle', message: 'Patching FCS team logos...' });
    
    try {
      const q = query(collection(db, 'teams'), where('isFCS', '==', true));
      const snapshot = await getDocs(q);
      
      let updatedCount = 0;
      const batch = writeBatch(db);

      snapshot.docs.forEach(teamDoc => {
        batch.update(teamDoc.ref, {
          logoId: '/assets/logos/resize.webp',
          logoUrl: '/assets/logos/resize.webp',
          updatedAt: new Date().toISOString()
        });
        updatedCount++;
      });

      await batch.commit();
      setMigrationStatus({ 
        type: 'success', 
        message: `Migration complete! Updated ${updatedCount} FCS teams.` 
      });
    } catch (error: any) {
      console.error('Migration error:', error);
      setMigrationStatus({ type: 'error', message: `Failed to migrate logos: ${error.message}` });
    } finally {
      setIsMigrating(false);
    }
  };

  const adminTools = [
    {
      title: 'Member Management',
      description: 'Manage coaches, roles, and school assignments.',
      icon: Users,
      path: '/admin/members',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    {
      title: 'Manage Coaches',
      description: 'Standalone database for the Coaching Carousel.',
      icon: UserPlus,
      path: '/admin/coaches',
      color: 'text-orange-600',
      bg: 'bg-orange-600/10'
    },
    {
      title: 'Shadow Coaches',
      description: 'Create placeholder entries for human coaches.',
      icon: UserPlus,
      path: '/admin/shadow-coaches',
      color: 'text-orange-500',
      bg: 'bg-orange-500/10'
    },
    {
      title: 'Pending Requests',
      description: 'Review and approve school join requests.',
      icon: UserPlus,
      path: '/admin/requests',
      color: 'text-zinc-500',
      bg: 'bg-zinc-500/10'
    },
    {
      title: 'Schedule Management',
      description: 'Add games, advance weeks, and manage matchups.',
      icon: Calendar,
      path: '/admin/schedule',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10'
    },
    {
      title: 'Manage Polls',
      description: 'Update weekly Top 25 rankings (Media, Coaches, CFP).',
      icon: Trophy,
      path: '/admin/polls',
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10'
    },
    {
      title: 'Bulk Stat Entry',
      description: 'Spreadsheet-style interface to override team season totals.',
      icon: Database,
      path: '/admin/bulk-stats',
      color: 'text-orange-600',
      bg: 'bg-orange-600/10'
    },
    {
      title: 'Identity Lab',
      description: 'Isolated sandbox for testing staffing & pilot logic.',
      icon: RefreshCw,
      path: '/admin/lab',
      color: 'text-green-500',
      bg: 'bg-green-500/10'
    },
    {
      title: 'League Settings',
      description: 'Configure league rules, year, and phase.',
      icon: Shield,
      path: '/admin/settings',
      color: 'text-zinc-500',
      bg: 'bg-zinc-500/10'
    }
  ];

  return (
    <div className="p-6 space-y-8 pb-24">
      <header className="space-y-2">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Shield className="w-8 h-8 text-orange-600" />
          Commissioner Tools
        </h1>
        <p className="text-zinc-500 font-medium">Manage your dynasty's infrastructure and members.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {adminTools.map((tool, index) => (
          <motion.div
            key={tool.path}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link
              to={tool.path}
              className="group flex items-center justify-between p-6 bg-zinc-900 border border-zinc-800 rounded-[32px] hover:border-orange-500/50 transition-all shadow-xl"
            >
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 ${tool.bg} rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <tool.icon className={`w-7 h-7 ${tool.color}`} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white group-hover:text-orange-500 transition-colors">{tool.title}</h3>
                  <p className="text-sm text-zinc-500 line-clamp-1">{tool.description}</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-zinc-700 group-hover:text-orange-500 transition-all group-hover:translate-x-1" />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* System Maintenance */}
      <div className="bg-zinc-900 p-8 rounded-[40px] border border-zinc-800 space-y-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-900">
              <Database className="text-orange-600 w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tight">System <span className="text-orange-600">Maintenance</span></h2>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Database Tools & Seeding</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isGlobalAdmin ? (
            <>
              <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-900 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    Seed FCS Teams
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">Inject standard EA Sports placeholder teams (FCS East, West, etc.) into the database.</p>
                </div>
                
                <button
                  onClick={seedFCSTeams}
                  disabled={isSeeding}
                  className="w-full py-3 bg-zinc-900 text-white font-black rounded-2xl border border-zinc-800 hover:border-orange-500/50 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px] disabled:opacity-50"
                >
                  {isSeeding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-orange-600" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 text-orange-600" />
                      Run FCS Seeding
                    </>
                  )}
                </button>

                {seedStatus.type !== 'idle' && (
                  <div className={`flex items-center gap-3 p-3 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                    seedStatus.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                    {seedStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {seedStatus.message}
                  </div>
                )}
              </div>

              <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-900 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    Migrate FCS Logos
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">Patch existing FCS team records with the new local logo path.</p>
                </div>
                
                <button
                  onClick={migrateFCSLogos}
                  disabled={isMigrating}
                  className="w-full py-3 bg-zinc-900 text-white font-black rounded-2xl border border-zinc-800 hover:border-orange-500/50 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px] disabled:opacity-50"
                >
                  {isMigrating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-orange-600" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 text-orange-600" />
                      Run Logo Migration
                    </>
                  )}
                </button>

                {migrationStatus.type !== 'idle' && (
                  <div className={`flex items-center gap-3 p-3 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                    migrationStatus.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                    {migrationStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {migrationStatus.message}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-900 flex items-center justify-center h-full">
              <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest text-center">
                Global admin access required for system maintenance.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats / Info */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-[40px] p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20">
            <Trophy className="text-white w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Dynasty <span className="text-orange-600">Control</span></h2>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">System Status: Operational</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Total Games</p>
            <p className="text-2xl font-black text-white">124</p>
          </div>
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Active Users</p>
            <p className="text-2xl font-black text-white">12</p>
          </div>
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Pending</p>
            <p className="text-2xl font-black text-orange-500">3</p>
          </div>
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Season Year</p>
            <p className="text-2xl font-black text-white">{leagueInfo?.currentYear || 2025}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
