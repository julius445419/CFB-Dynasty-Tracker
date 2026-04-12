import { db } from '../firebase';
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { CarouselCoach } from '../types';

/**
 * Commits staged staffing changes to Firestore using an atomic WriteBatch.
 * 
 * @param leagueId The ID of the league being updated.
 * @param stagedCoaches The final state of coaches after Lab manipulations.
 * @param liveCoaches The original state of coaches fetched from Firestore.
 * @returns A promise that resolves to the number of documents updated.
 */
export async function commitStaffingChanges(
  leagueId: string,
  stagedCoaches: CarouselCoach[],
  liveCoaches: CarouselCoach[]
): Promise<{ updatedCount: number }> {
  const batch = writeBatch(db);
  let updatedCount = 0;

  // Diff Engine: Find coaches whose critical fields have changed
  const changedCoaches = stagedCoaches.filter(staged => {
    const live = liveCoaches.find(l => l.id === staged.id);
    if (!live) return true; // New coach (shouldn't happen in this flow but good to have)

    return (
      staged.teamId !== live.teamId ||
      staged.role !== live.role ||
      staged.userId !== live.userId ||
      (staged as any).inviteCode !== (live as any).inviteCode
    );
  });

  for (const coach of changedCoaches) {
    const coachRef = doc(db, 'coaches', coach.id);
    
    // Prepare the update object
    const updateData: any = {
      teamId: coach.teamId,
      role: coach.role,
      userId: coach.userId || null,
      updatedAt: serverTimestamp()
    };

    // Handle invite codes for Shadows
    if ((coach as any).inviteCode) {
      updateData.inviteCode = (coach as any).inviteCode;
    }

    // If marked as retired (handled by disposition in Lab)
    // In this context, we assume the stagedCoaches already reflect the disposition
    if ((coach as any).status === 'retired') {
      updateData.status = 'retired';
      updateData.teamId = null;
    }

    batch.update(coachRef, updateData);
    updatedCount++;
  }

  if (updatedCount > 0) {
    await batch.commit();
  }

  return { updatedCount };
}
