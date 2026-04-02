import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Filter, User, ChevronRight, Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLeague } from '../../context/LeagueContext';
import { PlayerDrawer } from '../modals/PlayerDrawer';

interface Player {
  id: string;
  name: string;
  pos: string;
  year: string;
  ovr: number;
  archetype?: string;
  devTrait?: 'Normal' | 'Star' | 'Elite' | 'Generational';
  number?: number;
  height?: string;
  weight?: number;
}

export const RosterList: React.FC = () => {
  const { currentLeagueId, userTeam } = useLeague();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!currentLeagueId || !userTeam) return;

    setLoading(true);
    const playersRef = collection(db, 'leagues', currentLeagueId, 'players');
    const q = query(playersRef, where('teamId', '==', userTeam.id), orderBy('ovr', 'desc'));

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
  }, [currentLeagueId, userTeam]);

  const filteredPlayers = players.filter(p => 
    (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (p.pos?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const handlePlayerClick = (player: Player) => {
    setSelectedPlayer(player);
    setIsDrawerOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Scouting Roster...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Search Bar - Thumb Zone */}
      <div className="sticky top-0 z-10 pt-2 pb-4 bg-zinc-950/80 backdrop-blur-md">
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search by name or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl pl-12 pr-5 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-600/50 transition-all"
          />
        </div>
      </div>

      {/* Player List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredPlayers.map((player, index) => (
            <motion.button
              key={player.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handlePlayerClick(player)}
              className="w-full flex items-center justify-between p-4 bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-2xl hover:border-orange-600/50 transition-all active:scale-[0.98] group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-700 group-hover:bg-orange-600/10 group-hover:border-orange-600/30 transition-colors">
                  <span className="text-sm font-black text-white">{player.pos}</span>
                </div>
                <div className="text-left">
                  <h3 className="text-white font-black group-hover:text-orange-500 transition-colors">{player.name}</h3>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                    #{player.number || '??'} • {player.year}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:bg-orange-600 group-hover:border-orange-500 transition-all">
                  <span className="text-sm font-black text-white">{player.ovr}</span>
                </div>
                <ChevronRight className="text-zinc-700 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" size={20} />
              </div>
            </motion.button>
          ))}
        </AnimatePresence>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-20">
            <User className="mx-auto text-zinc-800 mb-4" size={48} />
            <h3 className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No players found</h3>
          </div>
        )}
      </div>

      {/* FAB - Thumb Zone */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-24 right-6 w-14 h-14 bg-orange-600 text-white rounded-2xl shadow-2xl shadow-orange-600/30 flex items-center justify-center z-20"
      >
        <Plus size={28} strokeWidth={3} />
      </motion.button>

      <PlayerDrawer 
        player={selectedPlayer}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
};
