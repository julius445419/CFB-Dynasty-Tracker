import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, Upload, Download, Loader2, User, 
  ChevronRight, X, AlertCircle, CheckCircle2, FileText,
  Shirt, Trash2, Archive, Eye, EyeOff
} from 'lucide-react';
import { 
  collection, query, where, onSnapshot, orderBy, 
  writeBatch, doc, getDocs, serverTimestamp, setDoc,
  updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { Player } from '../../types';
import Papa from 'papaparse';

interface RosterManagerProps {
  teamId: string;
}

export const RosterManager: React.FC<RosterManagerProps> = ({ teamId }) => {
  const { currentLeagueId } = useLeague();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePosition, setActivePosition] = useState('All');
  const [showArchived, setShowArchived] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Form State
  const [formData, setFormData] = useState({
    name: '',
    pos: 'QB',
    number: '',
    ovr: '70',
    year: 'Freshman',
    height: "6'0\"",
    weight: '200',
    archetype: '',
    physicalAbilities: '',
    mentalAbilities: '',
    redshirt: false
  });

  useEffect(() => {
    if (!currentLeagueId || !teamId) return;

    setLoading(true);
    const playersRef = collection(db, 'leagues', currentLeagueId, 'players');
    const q = query(playersRef, where('teamId', '==', teamId), orderBy('ovr', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rosterData: Player[] = [];
      snapshot.forEach((doc) => {
        rosterData.push({ id: doc.id, ...doc.data() } as Player);
      });
      setPlayers(rosterData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching roster:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentLeagueId, teamId]);

  const filteredPlayers = players.filter(p => {
    const matchesSearch = (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                         (p.pos?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesPosition = activePosition === 'All' || p.pos === activePosition;
    const matchesArchive = showArchived ? true : (p.isActive !== false);
    return matchesSearch && matchesPosition && matchesArchive;
  });

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLeagueId || !teamId) return;

    try {
      const playerRef = await savePlayer({
        name: formData.name,
        pos: formData.pos,
        number: parseInt(formData.number),
        ovr: parseInt(formData.ovr),
        year: formData.year as any,
        height: formData.height,
        weight: parseInt(formData.weight),
        archetype: formData.archetype,
        physicalAbilities: formData.physicalAbilities.split(',').map(s => s.trim()).filter(s => s),
        mentalAbilities: formData.mentalAbilities.split(',').map(s => s.trim()).filter(s => s),
        redshirt: formData.redshirt,
        isActive: true,
        teamId,
        leagueId: currentLeagueId
      });

      setIsAddModalOpen(false);
      setFormData({
        name: '', pos: 'QB', number: '', ovr: '70', year: 'Freshman',
        height: "6'0\"", weight: '200', archetype: '',
        physicalAbilities: '', mentalAbilities: '', redshirt: false
      });
    } catch (error) {
      console.error("Error saving player:", error);
    }
  };

  const savePlayer = async (playerData: Partial<Player>) => {
    if (!currentLeagueId || !teamId) return;

    const playersRef = collection(db, 'leagues', currentLeagueId, 'players');
    
    // Fetch existing roster for case-insensitive check
    const existingSnapshot = await getDocs(query(playersRef, where('teamId', '==', teamId)));
    let existingId = null;
    
    const searchName = playerData.name?.toLowerCase();
    const searchPos = playerData.pos?.toLowerCase();

    existingSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.name.toLowerCase() === searchName && data.pos.toLowerCase() === searchPos) {
        existingId = doc.id;
      }
    });

    let playerDocRef;

    if (existingId) {
      // Update existing
      playerDocRef = doc(db, 'leagues', currentLeagueId, 'players', existingId);
      await setDoc(playerDocRef, {
        ...playerData,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } else {
      // Create new
      playerDocRef = doc(playersRef);
      await setDoc(playerDocRef, {
        ...playerData,
        id: playerDocRef.id,
        createdAt: serverTimestamp()
      });
    }
    return playerDocRef;
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentLeagueId || !teamId) return;

    setIsImporting(true);
    setImportStatus(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          const validRows = rows.filter(row => row.Name && row.Position && row.Number);
          
          if (validRows.length === 0) {
            setImportStatus({ type: 'error', message: 'No valid players found in CSV. Ensure Name, Position, and Number are present.' });
            setIsImporting(false);
            return;
          }

          // Fetch existing roster to check for matches locally (more efficient than querying for each row)
          const playersRef = collection(db, 'leagues', currentLeagueId, 'players');
          const existingSnapshot = await getDocs(query(playersRef, where('teamId', '==', teamId)));
          const existingMap = new Map();
          existingSnapshot.forEach(doc => {
            const data = doc.data();
            const key = `${data.name.toLowerCase()}_${data.pos.toLowerCase()}`;
            existingMap.set(key, doc.id);
          });

          // Process in batches of 500
          const chunkSize = 500;
          for (let i = 0; i < validRows.length; i += chunkSize) {
            const batch = writeBatch(db);
            const chunk = validRows.slice(i, i + chunkSize);

            chunk.forEach(row => {
              const key = `${row.Name.toLowerCase()}_${row.Position.toLowerCase()}`;
              const existingId = existingMap.get(key);
              
              const playerData: any = {
                name: row.Name,
                pos: row.Position,
                number: parseInt(row.Number) || 0,
                ovr: parseInt(row.OVR) || 70,
                year: row.Year || 'Freshman',
                height: row.Height || "6'0\"",
                weight: parseInt(row.Weight) || 200,
                archetype: row.Archetype || '',
                physicalAbilities: row.PhysicalAbilities ? row.PhysicalAbilities.split(',').map((s: string) => s.trim()) : [],
                mentalAbilities: row.MentalAbilities ? row.MentalAbilities.split(',').map((s: string) => s.trim()) : [],
                redshirt: row.Redshirt?.toLowerCase() === 'true',
                isActive: row.IsActive?.toLowerCase() !== 'false',
                teamId,
                leagueId: currentLeagueId,
                updatedAt: serverTimestamp()
              };

              if (existingId) {
                const ref = doc(db, 'leagues', currentLeagueId, 'players', existingId);
                batch.update(ref, playerData);
              } else {
                const ref = doc(playersRef);
                batch.set(ref, {
                  ...playerData,
                  id: ref.id,
                  createdAt: serverTimestamp()
                });
              }
            });

            await batch.commit();
          }

          setImportStatus({ type: 'success', message: `Successfully imported/updated ${validRows.length} players.` });
        } catch (error) {
          console.error("CSV Import Error:", error);
          setImportStatus({ type: 'error', message: 'Failed to import roster. Check console for details.' });
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error("PapaParse Error:", error);
        setImportStatus({ type: 'error', message: 'Error parsing CSV file.' });
        setIsImporting(false);
      }
    });
  };

  const downloadTemplate = () => {
    const headers = ['Name', 'Position', 'Number', 'OVR', 'Year', 'Height', 'Weight', 'Archetype', 'PhysicalAbilities', 'MentalAbilities', 'Redshirt', 'IsActive'];
    const csvContent = headers.join(',') + '\n' + 
      'John Doe,QB,12,85,Junior,6\'2",215,Field General,"Quick Read, Strong Arm","Leadership",false,true';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'roster_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = () => {
    if (players.length === 0) return;

    const exportData = players.map(p => ({
      Name: p.name,
      Position: p.pos,
      Number: p.number,
      OVR: p.ovr,
      Year: p.year,
      Height: p.height,
      Weight: p.weight,
      Archetype: p.archetype || '',
      PhysicalAbilities: (p.physicalAbilities || []).join(', '),
      MentalAbilities: (p.mentalAbilities || []).join(', '),
      Redshirt: p.redshirt,
      IsActive: p.isActive !== false
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `Roster_Export_${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleRedshirt = async (player: Player) => {
    if (!currentLeagueId) return;

    // Optimistic UI
    const updatedPlayers = players.map(p => 
      p.id === player.id ? { ...p, redshirt: !p.redshirt } : p
    );
    setPlayers(updatedPlayers);

    try {
      const playerRef = doc(db, 'leagues', currentLeagueId, 'players', player.id);
      await updateDoc(playerRef, {
        redshirt: !player.redshirt,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error toggling redshirt:", error);
      // Revert if failed
      setPlayers(players);
    }
  };

  const handleArchivePlayer = async (player: Player) => {
    if (!currentLeagueId) return;
    const newStatus = player.isActive === false ? true : false;

    try {
      const playerRef = doc(db, 'leagues', currentLeagueId, 'players', player.id);
      await updateDoc(playerRef, {
        isActive: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error archiving player:", error);
    }
  };

  const handleDeletePlayer = async (player: Player) => {
    if (!currentLeagueId) return;
    if (!window.confirm(`Are you sure you want to delete ${player.name}? This will break historical stats if this player played in games.`)) {
      return;
    }

    try {
      const playerRef = doc(db, 'leagues', currentLeagueId, 'players', player.id);
      await deleteDoc(playerRef);
    } catch (error) {
      console.error("Error deleting player:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center border border-orange-600/20">
            <User className="text-orange-500" size={20} />
          </div>
          <div>
            <h3 className="text-white font-black text-sm uppercase tracking-wider">Roster Management</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{players.length} Players Active</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-xs transition-all active:scale-95"
          >
            <Plus size={16} />
            Add Player
          </button>
          
          <div className="relative flex-1 sm:flex-none">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCSVUpload}
              accept=".csv"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              Import
            </button>
          </div>

          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95"
          >
            <Download size={16} />
            Export
          </button>

          <button
            onClick={downloadTemplate}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all"
            title="Download CSV Template"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Status Messages */}
      <AnimatePresence>
        {importStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-center gap-3 border ${
              importStatus.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                : 'bg-red-500/10 border-red-500/20 text-red-500'
            }`}
          >
            {importStatus.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-xs font-bold">{importStatus.message}</span>
            <button onClick={() => setImportStatus(null)} className="ml-auto">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & List */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Search roster..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/30 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={activePosition}
              onChange={(e) => setActivePosition(e.target.value)}
              className="flex-1 md:w-auto bg-zinc-900/30 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all appearance-none cursor-pointer"
            >
              <option value="All">All Positions</option>
              <optgroup label="Offense">
                {['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'].map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </optgroup>
              <optgroup label="Defense">
                {['LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS'].map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </optgroup>
              <optgroup label="Special Teams">
                {['K', 'P'].map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </optgroup>
            </select>

            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`px-4 py-3 rounded-xl border transition-all flex items-center gap-2 font-bold text-xs ${
                showArchived 
                  ? 'bg-orange-600 border-orange-500 text-white' 
                  : 'bg-zinc-900/30 border-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {showArchived ? <Eye size={16} /> : <EyeOff size={16} />}
              <span className="hidden sm:inline">{showArchived ? 'Showing All' : 'Active Only'}</span>
            </button>
          </div>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/50 border-b border-zinc-800">
                  <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest">#</th>
                  <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Player</th>
                  <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Pos</th>
                  <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">OVR</th>
                  <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Year</th>
                  <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">RS</th>
                  <th className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredPlayers.map((player) => (
                  <tr key={player.id} className={`hover:bg-zinc-800/30 transition-colors group ${player.isActive === false ? 'opacity-50 grayscale' : ''}`}>
                    <td className="px-4 py-4 text-sm font-bold text-zinc-400">#{player.number}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-white group-hover:text-orange-500 transition-colors">
                          {player.name}
                          {player.isActive === false && <span className="ml-2 text-[8px] bg-zinc-800 px-1 rounded text-zinc-500">ARCHIVED</span>}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">{player.height} • {player.weight} lbs</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-block px-2 py-1 bg-zinc-800 rounded text-[10px] font-black text-white border border-zinc-700">{player.pos}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto group-hover:bg-orange-600 group-hover:border-orange-500 transition-all">
                        <span className="text-xs font-black text-white">{player.ovr}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs font-bold text-zinc-400">{player.year}</td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleToggleRedshirt(player)}
                        className={`p-2 rounded-lg transition-all ${
                          player.redshirt 
                            ? 'bg-orange-600/20 text-orange-500 border border-orange-500/30' 
                            : 'bg-zinc-800 text-zinc-600 border border-zinc-700 hover:text-zinc-400'
                        }`}
                        title={player.redshirt ? "Remove Redshirt" : "Apply Redshirt"}
                      >
                        <Shirt size={14} strokeWidth={player.redshirt ? 3 : 2} />
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleArchivePlayer(player)}
                          className={`p-2 rounded-lg border transition-all ${
                            player.isActive === false
                              ? 'bg-emerald-600/10 border-emerald-600/20 text-emerald-500 hover:bg-emerald-600/20'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700'
                          }`}
                          title={player.isActive === false ? "Restore Player" : "Archive Player"}
                        >
                          <Archive size={14} />
                        </button>
                        <button
                          onClick={() => handleDeletePlayer(player)}
                          className="p-2 bg-zinc-800 border border-zinc-700 text-zinc-500 hover:bg-red-600/10 hover:border-red-600/20 hover:text-red-500 rounded-lg transition-all"
                          title="Delete Player"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredPlayers.length === 0 && !loading && (
            <div className="py-20 text-center">
              <User className="mx-auto text-zinc-800 mb-4" size={48} />
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No players found</p>
            </div>
          )}

          {loading && (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Loading Roster...</p>
            </div>
          )}
        </div>
      </div>

      {/* Manual Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20">
                    <Plus className="text-white" size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Add New Player</h2>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Manual Entry</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleManualSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Required Fields */}
                  <div className="space-y-4">
                    <h3 className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em]">Required Info</h3>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Full Name</label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                        placeholder="e.g. John Doe"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Position</label>
                        <select
                          required
                          value={formData.pos}
                          onChange={(e) => setFormData({ ...formData, pos: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                        >
                          {['QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'DE', 'DT', 'OLB', 'MLB', 'CB', 'FS', 'SS', 'K', 'P'].map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Number</label>
                        <input
                          required
                          type="number"
                          value={formData.number}
                          onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                          placeholder="0-99"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Physical Info */}
                  <div className="space-y-4">
                    <h3 className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em]">Physical & Rating</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Overall (OVR)</label>
                        <input
                          type="number"
                          value={formData.ovr}
                          onChange={(e) => setFormData({ ...formData, ovr: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Year</label>
                        <select
                          value={formData.year}
                          onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                        >
                          {['Freshman', 'Sophomore', 'Junior', 'Senior'].map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Height</label>
                        <input
                          type="text"
                          value={formData.height}
                          onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                          placeholder="6'2&quot;"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Weight (lbs)</label>
                        <input
                          type="number"
                          value={formData.weight}
                          onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Advanced Info */}
                <div className="space-y-4 pt-4 border-t border-zinc-800">
                  <h3 className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em]">Abilities & Archetype</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Archetype</label>
                      <input
                        type="text"
                        value={formData.archetype}
                        onChange={(e) => setFormData({ ...formData, archetype: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
                        placeholder="e.g. Field General, Elusive, Power"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Physical Abilities (Comma Separated)</label>
                      <textarea
                        value={formData.physicalAbilities}
                        onChange={(e) => setFormData({ ...formData, physicalAbilities: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all min-h-[80px]"
                        placeholder="e.g. Quick Read, Strong Arm, Mobile"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Mental Abilities (Comma Separated)</label>
                      <textarea
                        value={formData.mentalAbilities}
                        onChange={(e) => setFormData({ ...formData, mentalAbilities: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all min-h-[80px]"
                        placeholder="e.g. Leadership, Clutch, Field Vision"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="redshirt"
                    checked={formData.redshirt}
                    onChange={(e) => setFormData({ ...formData, redshirt: e.target.checked })}
                    className="w-5 h-5 rounded bg-zinc-950 border-zinc-800 text-orange-600 focus:ring-orange-600/50"
                  />
                  <label htmlFor="redshirt" className="text-sm font-bold text-zinc-300">Redshirt Player</label>
                </div>

                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] px-6 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-orange-600/20 active:scale-95"
                  >
                    Save Player
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
