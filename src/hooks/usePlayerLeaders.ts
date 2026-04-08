import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useLeague } from '../context/LeagueContext';
import { Player } from '../types';

export type PlayerStatCategory = 
  | 'seasonPassYds' 
  | 'seasonPassTDs' 
  | 'seasonPassInts' 
  | 'seasonRushYds' 
  | 'seasonRushTDs' 
  | 'seasonRecYds' 
  | 'seasonRecTDs' 
  | 'seasonReceptions' 
  | 'seasonTackles' 
  | 'seasonSacks' 
  | 'seasonInts';

export const usePlayerLeaders = (category: PlayerStatCategory, limitCount: number = 25) => {
  const { currentLeagueId } = useLeague();
  const [leaders, setLeaders] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentLeagueId) return;

    setLoading(true);
    const playersRef = collection(db, 'leagues', currentLeagueId, 'players');
    
    // Query players sorted by the selected category
    const q = query(
      playersRef,
      where(category, '>', 0), // Only show players with stats in this category
      orderBy(category, 'desc'),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const playersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Player[];
      setLeaders(playersData);
      setLoading(false);
    }, (err) => {
      console.error(`Error fetching player leaders for ${category}:`, err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentLeagueId, category, limitCount]);

  return { leaders, loading, error };
};
