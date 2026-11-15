import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '@/types';
import { authService } from '@/services/firebase/authService';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { initializeDemoDataIfEmpty } from '@/utils/seedDemoData';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithDemoPersona: (persona: 'krish' | 'rahul' | 'priya') => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  isFirebaseConnected: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const isFirebaseConnected = isFirebaseConfigured();

  useEffect(() => {
    initializeDemoDataIfEmpty();

    const unsubscribe = authService.onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      await authService.signInWithGoogle();
    } finally {
      setLoading(false);
    }
  };

  const signInWithDemoPersona = async (persona: 'krish' | 'rahul' | 'priya') => {
    setLoading(true);
    try {
      const profile = await authService.signInWithDemoPersona(persona);
      setUser(profile);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    await authService.updateProfile(user.uid, updates);
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithDemoPersona,
        signOut,
        updateProfile,
        isFirebaseConnected,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
