import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Sync profile to Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const emailPrefix = user.email?.split('@')[0] || 'user';
        
        const userData: any = {
          displayName: user.displayName || emailPrefix,
          email: user.email,
          photoURL: user.photoURL,
          lastLogin: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        // AC1 & AC2: Set systemName if it doesn't exist (new or migration)
        if (!userSnap.exists() || !userSnap.data()?.systemName) {
          userData.systemName = emailPrefix;
        }

        await setDoc(userRef, userData, { merge: true });
      }
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
