import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

export async function claimCoachProfile(userId: string, inviteCode: string) {
  // 1. Find the coach document with this invite code
  const coachesRef = collection(db, 'coaches');
  const q = query(coachesRef, where('inviteCode', '==', inviteCode));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error('Invalid or expired invite code.');
  }

  const coachDoc = querySnapshot.docs[0];
  const coachData = coachDoc.data();
  const leagueId = coachData.leagueId;
  const teamId = coachData.teamId;
  const coachName = coachData.name;

  // 2. Validation
  if (coachData.userId || coachData.isLinked) {
    throw new Error('This profile has already been claimed.');
  }

  // 3. Atomic Transaction
  const batch = writeBatch(db);

  // Operation 1: Update the coaches document
  const coachRef = doc(db, 'coaches', coachDoc.id);
  batch.update(coachRef, {
    userId: userId,
    isLinked: true,
    inviteCode: null,
    updatedAt: serverTimestamp()
  });

  // Operation 2: Update the team document
  // Path: /leagues/{leagueId}/teams/{teamId}
  const teamRef = doc(db, 'leagues', leagueId, 'teams', teamId);
  batch.update(teamRef, {
    ownerId: userId,
    isPlaceholder: false,
    isLinked: true,
    linkedUserId: userId,
    inviteCode: null,
    updatedAt: serverTimestamp()
  });

  // Operation 3: Upsert member document
  // Path: /leagues/{leagueId}/members/{userId}
  const memberRef = doc(db, 'leagues', leagueId, 'members', userId);
  batch.set(memberRef, {
    userId: userId,
    role: 'coach',
    teamId: teamId,
    joinedAt: serverTimestamp(),
    permissions: {
      canEditTeam: true,
      canDeleteCoaches: false,
      canDeleteLeague: false
    }
  }, { merge: true });

  await batch.commit();

  return {
    leagueId,
    teamId,
    coachName
  };
}
