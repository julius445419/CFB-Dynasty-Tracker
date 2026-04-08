import React, { useState, useEffect } from 'react';
import { useLeague } from '../context/LeagueContext';
import { 
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Save, Edit2, X, Lock, Shield, Clock, Settings2, AlertCircle, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { LeagueSettings as ILeagueSettings } from '../types';

export const LeagueSettings: React.FC = () => {
  const { leagueInfo, userRole } = useLeague();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState<number>(leagueInfo?.currentYear || 2025);
  const [currentWeek, setCurrentWeek] = useState<number>(leagueInfo?.currentWeek ?? 0);
  const [seasonPhase, setSeasonPhase] = useState<string>(leagueInfo?.seasonPhase || 'Off Season');
  const [isSaving, setIsSaving] = useState(false);
  const [shouldMigrateGames, setShouldMigrateGames] = useState(true);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [confirmSync, setConfirmSync] = useState(false);
  const [draftSettings, setDraftSettings] = useState<ILeagueSettings>(leagueInfo?.settings || {
    skillLevel: 'All-American',
    coachXP: 'Normal',
    injuryEnabled: true,
    manualProgressionXP: 100,
    playcallCooldownEnabled: false,
    playcallCooldownValue: 0,
    quarterLength: 6,
    acceleratedClockEnabled: true,
    minPlayclockTime: 20,
    maxUsers: 32,
    crossPlayEnabled: true,
    houseRules: '',
    wearAndTearEnabled: true,
    wearAndTearSettings: {
      normalTackleImpact: 100,
      catchTackleImpact: 100,
      hitStickImpact: 100,
      cutStickImpact: 100,
      defenderTackleAdvantageImpact: 100,
      sackImpact: 100,
      impactBlockImpact: 100,
      perPlayRecovery: 100,
      perTimeoutRecovery: 100,
      betweenQuarterRecovery: 100,
      halftimeRecovery: 100,
      weekToWeekRecovery: 100,
      inGameHealingReservePool: 100,
    },
    maxTransfersPerTeam: 5,
    userPlayerTransferChance: 50,
    cpuPlayerTransferChance: 50,
  });

  const isAdmin = userRole === 'Owner' || userRole === 'Commissioner';

  useEffect(() => {
    if (leagueInfo) {
      if (leagueInfo.settings) setDraftSettings(leagueInfo.settings);
      setCurrentYear(leagueInfo.currentYear || 2025);
      setCurrentWeek(leagueInfo.currentWeek ?? 0);
      setSeasonPhase(leagueInfo.seasonPhase || 'Off Season');
    }
  }, [leagueInfo]);

  const validateSettings = () => {
    if (draftSettings.quarterLength < 3 || draftSettings.quarterLength > 15) {
      setError('Quarter Length must be between 3 and 15 minutes.');
      return false;
    }
    if (draftSettings.manualProgressionXP < 0 || draftSettings.manualProgressionXP > 100) {
      setError('XP Penalty must be between 0 and 100%.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!leagueInfo?.id) return;
    if (!validateSettings()) return;

    setIsSaving(true);
    setError(null);

    try {
      const newYear = parseInt(currentYear.toString());
      const oldYear = leagueInfo.currentYear ? parseInt(leagueInfo.currentYear.toString()) : 2025;
      const batch = writeBatch(db);

      // If the year has changed and migration is enabled
      if (newYear !== oldYear && shouldMigrateGames) {
        const gamesRef = collection(db, 'leagues', leagueInfo.id, 'games');
        const snapshot = await getDocs(gamesRef);
        
        snapshot.docs.forEach(gameDoc => {
          const data = gameDoc.data();
          // Update if it matches the old year OR if it has no season field (legacy)
          if (data.season === oldYear || !data.season) {
            batch.update(gameDoc.ref, { 
              season: newYear,
              updatedAt: serverTimestamp()
            });
          }
        });
      }

      // Update the league document
      batch.update(doc(db, 'leagues', leagueInfo.id), {
        settings: draftSettings,
        currentYear: newYear,
        currentWeek: Number(currentWeek),
        seasonPhase: seasonPhase
      });

      await batch.commit();
      setIsEditing(false);
      setSyncStatus({ type: 'success', message: 'Settings saved successfully!' });
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setError(`Failed to save settings: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncGames = async () => {
    if (!leagueInfo?.id) return;
    
    if (!confirmSync) {
      setConfirmSync(true);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSyncStatus(null);

    try {
      const targetYear = parseInt(currentYear.toString());
      const gamesRef = collection(db, 'leagues', leagueInfo.id, 'games');
      const snapshot = await getDocs(gamesRef);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(gameDoc => {
        batch.update(gameDoc.ref, { 
          season: targetYear,
          updatedAt: serverTimestamp()
        });
      });
      
      // Also ensure league year matches
      batch.update(doc(db, 'leagues', leagueInfo.id), {
        currentYear: targetYear
      });
      
      await batch.commit();
      setSyncStatus({ type: 'success', message: `Successfully synced ${snapshot.docs.length} games to ${targetYear}.` });
      setConfirmSync(false);
      setIsEditing(false);
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      console.error("Error syncing games:", err);
      setError(`Failed to sync games: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (leagueInfo) {
      if (leagueInfo.settings) setDraftSettings(leagueInfo.settings);
      setCurrentYear(leagueInfo.currentYear || 2025);
      setCurrentWeek(leagueInfo.currentWeek ?? 0);
      setSeasonPhase(leagueInfo.seasonPhase || 'Off Season');
    }
    setError(null);
    setConfirmSync(false);
    setIsEditing(false);
  };

  if (!leagueInfo) return <div>Loading...</div>;

  return (
    <div className="p-6 space-y-8 pb-24">
      <header className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-white flex items-center gap-3 italic tracking-tight uppercase">
            <Shield className="w-8 h-8 text-orange-600" />
            League <span className="text-orange-600">Governance</span>
          </h1>
          <p className="text-zinc-500 font-medium tracking-wide uppercase text-xs">Configure dynasty rules and gameplay mechanics.</p>
        </div>
        {isAdmin && (
          isEditing ? (
            <div className="flex gap-3">
              <button 
                onClick={handleCancel} 
                disabled={isSaving}
                className="px-6 py-2.5 bg-zinc-900 text-zinc-400 font-bold rounded-2xl border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all flex items-center gap-2 uppercase tracking-widest text-xs disabled:opacity-50"
              >
                <X size={16} /> Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="px-6 py-2.5 bg-orange-600 text-white font-bold rounded-2xl hover:bg-orange-500 transition-all flex items-center gap-2 uppercase tracking-widest text-xs shadow-lg shadow-orange-600/20 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditing(true)} 
              className="px-6 py-2.5 bg-zinc-900 text-white font-bold rounded-2xl border border-zinc-800 hover:border-orange-500/50 transition-all flex items-center gap-2 uppercase tracking-widest text-xs"
            >
              <Edit2 size={16} /> Edit Settings
            </button>
          )
        )}
      </header>

      {syncStatus && (
        <div className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${
          syncStatus.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/50 text-emerald-500' : 'bg-red-500/10 border border-red-500/50 text-red-500'
        }`}>
          {syncStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {syncStatus.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Season Management */}
        <div className="bg-zinc-900 p-8 rounded-[32px] border border-zinc-800 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Season <span className="text-orange-600">Management</span></h2>
          </div>

          <div className="flex items-center gap-3 p-4 bg-orange-600/10 border border-orange-600/20 rounded-2xl">
            <AlertCircle className="text-orange-500 shrink-0" size={18} />
            <p className="text-[10px] font-black text-orange-200 uppercase tracking-widest leading-relaxed">
              Updating the season year is non-destructive. Your historical games and stats will be preserved, but the app will transition to showing data for the new active season.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Active Season Year</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={currentYear}
                  onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                  disabled={!isEditing}
                  className="flex-1 bg-zinc-950 text-white p-4 rounded-2xl border border-zinc-900 focus:border-orange-600 outline-none transition-all font-bold disabled:opacity-50"
                />
                {isEditing && (
                  <button
                    onClick={handleSyncGames}
                    disabled={isSaving}
                    className={`px-4 rounded-2xl border transition-all flex items-center justify-center group relative ${
                      confirmSync 
                        ? 'bg-orange-600 border-orange-500 text-white animate-pulse' 
                        : 'bg-zinc-800 border-zinc-700 text-orange-500 hover:bg-zinc-700'
                    }`}
                    title={confirmSync ? "Click again to confirm sync" : "Force sync all games to this year"}
                  >
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-5 h-5" />
                    )}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-[8px] font-bold text-zinc-400 uppercase tracking-widest text-center shadow-2xl z-50">
                      {confirmSync ? "CONFIRM: Update ALL games to this year?" : "Sync all games to this year"}
                    </div>
                  </button>
                )}
              </div>
              
              {isEditing && currentYear !== (leagueInfo?.currentYear || 2025) && (
                <div className="mt-3 p-3 bg-zinc-950 border border-zinc-900 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">Migrate Games?</span>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-tighter">Update existing games to {currentYear}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={shouldMigrateGames}
                    onChange={(e) => setShouldMigrateGames(e.target.checked)}
                    className="w-5 h-5 accent-orange-600 cursor-pointer"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Current Week</label>
              <input
                type="number"
                min="0"
                max="20"
                value={currentWeek}
                onChange={(e) => setCurrentWeek(parseInt(e.target.value))}
                disabled={!isEditing}
                className="w-full bg-zinc-950 text-white p-4 rounded-2xl border border-zinc-900 focus:border-orange-600 outline-none transition-all font-bold disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Dynasty Phase</label>
            <select
              value={seasonPhase}
              onChange={(e) => setSeasonPhase(e.target.value)}
              disabled={!isEditing}
              className="w-full bg-zinc-950 text-white p-4 rounded-2xl border border-zinc-900 focus:border-orange-600 outline-none transition-all font-bold disabled:opacity-50"
            >
              <option value="Off Season">Off Season</option>
              <option value="Pre-Season">Pre-Season</option>
              <option value="Regular Season">Regular Season</option>
              <option value="Conference Championships">Conference Championships</option>
              <option value="Bowl Season">Bowl Season</option>
              <option value="National Championship">National Championship</option>
              <option value="Coaching Carousel">Coaching Carousel</option>
              <option value="Transfer Portal">Transfer Portal</option>
              <option value="Training Results">Training Results</option>
            </select>
          </div>
        </div>

        {/* Core Settings */}
        <div className="bg-zinc-900 p-8 rounded-[32px] border border-zinc-800 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <Settings2 className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Core <span className="text-orange-600">Settings</span></h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">League Name</label>
              <div className="flex items-center gap-3 text-white bg-zinc-950 p-4 rounded-2xl border border-zinc-900 font-bold">
                <Lock size={16} className="text-zinc-700" />
                {leagueInfo.name}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Maximum Users</label>
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={draftSettings.maxUsers}
                  onChange={(e) => setDraftSettings({ ...draftSettings, maxUsers: parseInt(e.target.value) })}
                  disabled={!isEditing}
                  className="w-full bg-zinc-950 text-white p-4 rounded-2xl border border-zinc-900 focus:border-orange-600 outline-none transition-all font-bold disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col justify-center">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Cross-Play</label>
                <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
                  <span className="text-sm font-bold text-zinc-400">{draftSettings.crossPlayEnabled ? 'Enabled' : 'Disabled'}</span>
                  <input
                    type="checkbox"
                    checked={draftSettings.crossPlayEnabled}
                    onChange={(e) => setDraftSettings({ ...draftSettings, crossPlayEnabled: e.target.checked })}
                    disabled={!isEditing}
                    className="w-6 h-6 accent-orange-600 disabled:opacity-50 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Commissioner Settings */}
        <div className="bg-zinc-900 p-8 rounded-[32px] border border-zinc-800 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Commissioner <span className="text-orange-600">Settings</span></h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Skill Level</label>
              <select
                value={draftSettings.skillLevel}
                onChange={(e) => setDraftSettings({ ...draftSettings, skillLevel: e.target.value as any })}
                disabled={!isEditing}
                className="w-full bg-zinc-950 text-white p-4 rounded-2xl border border-zinc-900 focus:border-orange-600 outline-none transition-all font-bold disabled:opacity-50"
              >
                <option value="Freshman">Freshman</option>
                <option value="Varsity">Varsity</option>
                <option value="All-American">All-American</option>
                <option value="Heisman">Heisman</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Coach XP Setting</label>
              <select
                value={draftSettings.coachXP}
                onChange={(e) => setDraftSettings({ ...draftSettings, coachXP: e.target.value as any })}
                disabled={!isEditing}
                className="w-full bg-zinc-950 text-white p-4 rounded-2xl border border-zinc-900 focus:border-orange-600 outline-none transition-all font-bold disabled:opacity-50"
              >
                <option value="Slowest">Slowest</option>
                <option value="Slow">Slow</option>
                <option value="Normal">Normal</option>
                <option value="Fast">Fast</option>
                <option value="Fastest">Fastest</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col justify-center">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Injuries</label>
              <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
                <span className="text-sm font-bold text-zinc-400">{draftSettings.injuryEnabled ? 'On' : 'Off'}</span>
                <input
                  type="checkbox"
                  checked={draftSettings.injuryEnabled}
                  onChange={(e) => setDraftSettings({ ...draftSettings, injuryEnabled: e.target.checked })}
                  disabled={!isEditing}
                  className="w-6 h-6 accent-orange-600 disabled:opacity-50 cursor-pointer"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">XP Penalty %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={draftSettings.manualProgressionXP}
                onChange={(e) => setDraftSettings({ ...draftSettings, manualProgressionXP: parseInt(e.target.value) })}
                disabled={!isEditing}
                className="w-full bg-zinc-950 text-white p-4 rounded-2xl border border-zinc-900 focus:border-orange-600 outline-none transition-all font-bold disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col justify-center">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Playcall Cool Down</label>
              <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
                <span className="text-sm font-bold text-zinc-400">{draftSettings.playcallCooldownEnabled ? 'On' : 'Off'}</span>
                <input
                  type="checkbox"
                  checked={draftSettings.playcallCooldownEnabled}
                  onChange={(e) => setDraftSettings({ ...draftSettings, playcallCooldownEnabled: e.target.checked })}
                  disabled={!isEditing}
                  className="w-6 h-6 accent-orange-600 disabled:opacity-50 cursor-pointer"
                />
              </div>
            </div>
            {(!isEditing ? draftSettings.playcallCooldownEnabled : true) && (
              <div className={!draftSettings.playcallCooldownEnabled ? 'opacity-0 pointer-events-none' : ''}>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Cool Down Limit</label>
                <input
                  type="number"
                  min="0"
                  value={draftSettings.playcallCooldownValue || 0}
                  onChange={(e) => setDraftSettings({ ...draftSettings, playcallCooldownValue: parseInt(e.target.value) })}
                  disabled={!isEditing || !draftSettings.playcallCooldownEnabled}
                  className="w-full bg-zinc-950 text-white p-4 rounded-2xl border border-zinc-900 focus:border-orange-600 outline-none transition-all font-bold disabled:opacity-50"
                />
              </div>
            )}
          </div>
        </div>

        {/* Clock Management */}
        <div className="bg-zinc-900 p-8 rounded-[32px] border border-zinc-800 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Clock <span className="text-orange-600">Management</span></h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Quarter Length</label>
              <select
                value={draftSettings.quarterLength}
                onChange={(e) => setDraftSettings({ ...draftSettings, quarterLength: parseInt(e.target.value) })}
                disabled={!isEditing}
                className="w-full bg-zinc-950 text-white p-4 rounded-2xl border border-zinc-900 focus:border-orange-600 outline-none transition-all font-bold disabled:opacity-50"
              >
                {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(len => (
                  <option key={len} value={len}>{len} Minutes</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-center">
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Accelerated Clock</label>
              <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
                <span className="text-sm font-bold text-zinc-400">{draftSettings.acceleratedClockEnabled ? 'On' : 'Off'}</span>
                <input
                  type="checkbox"
                  checked={draftSettings.acceleratedClockEnabled}
                  onChange={(e) => setDraftSettings({ ...draftSettings, acceleratedClockEnabled: e.target.checked })}
                  disabled={!isEditing}
                  className="w-6 h-6 accent-orange-600 disabled:opacity-50 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {(!isEditing ? draftSettings.acceleratedClockEnabled : true) && (
            <div className={!draftSettings.acceleratedClockEnabled ? 'opacity-0 pointer-events-none' : ''}>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Minimum Playclock Time</label>
              <input
                type="number"
                min="10"
                max="25"
                value={draftSettings.minPlayclockTime || 20}
                onChange={(e) => setDraftSettings({ ...draftSettings, minPlayclockTime: parseInt(e.target.value) })}
                disabled={!isEditing || !draftSettings.acceleratedClockEnabled}
                className="w-full bg-zinc-950 text-white p-4 rounded-2xl border border-zinc-900 focus:border-orange-600 outline-none transition-all font-bold disabled:opacity-50"
              />
            </div>
          )}
        </div>

        {/* House Rules */}
        <div className="bg-zinc-900 p-8 rounded-[32px] border border-zinc-800 space-y-6 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <Lock className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-black text-white uppercase italic tracking-tight">House <span className="text-orange-600">Rules</span></h2>
          </div>
          <textarea
            value={draftSettings.houseRules}
            onChange={(e) => setDraftSettings({ ...draftSettings, houseRules: e.target.value })}
            disabled={!isEditing}
            className="w-full h-48 bg-zinc-950 text-white p-6 rounded-[24px] border border-zinc-900 focus:border-orange-600 outline-none transition-all font-bold disabled:opacity-50 resize-none"
            placeholder="Enter house rules here..."
          />
        </div>
      </div>
    </div>
  );
};
