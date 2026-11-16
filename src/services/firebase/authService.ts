import {
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { auth, db, googleProvider, isFirebaseConfigured } from './config';
import { UserProfile } from '@/types';
import { getFirstName } from '@/utils/name';

const MOCK_STORAGE_KEY = 'splitify_mock_user';

export const authService = {
  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (user: UserProfile | null) => void): () => void {
    if (!isFirebaseConfigured() || !auth) {
      // Demo mode fallback from localStorage
      const saved = localStorage.getItem(MOCK_STORAGE_KEY);
      if (saved) {
        try {
          callback(JSON.parse(saved));
        } catch {
          callback(null);
        }
      } else {
        callback(null);
      }
      const listener = () => {
        const updated = localStorage.getItem(MOCK_STORAGE_KEY);
        callback(updated ? JSON.parse(updated) : null);
      };
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    }

    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        callback(null);
        return;
      }

      try {
        const userProfile = await authService.getOrCreateProfile(fbUser);
        callback(userProfile);
      } catch (err) {
        console.error('[Splitify] Error fetching user profile:', err);
        // Fallback profile if Firestore is momentarily unreachable
        const fallbackName = getFirstName(fbUser.displayName || fbUser.email?.split('@')[0] || 'User');
        callback({
          uid: fbUser.uid,
          displayName: fallbackName,
          email: fbUser.email || '',
          photoURL: fbUser.photoURL || undefined,
          createdAt: Date.now(),
        });
      }
    });
  },

  /**
   * Fetch or create user profile in Firestore
   */
  async getOrCreateProfile(fbUser: FirebaseUser): Promise<UserProfile> {
    if (!db) throw new Error('Firestore not initialized');

    const userRef = doc(db, 'users', fbUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    // Default to the first name from Gmail display name or email username
    const rawName = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
    const initialFirstName = getFirstName(rawName);

    const newProfile: UserProfile = {
      uid: fbUser.uid,
      displayName: initialFirstName,
      email: fbUser.email || '',
      photoURL: fbUser.photoURL || undefined,
      createdAt: Date.now(),
      preferences: {
        theme: 'system',
        currency: 'INR',
      },
      discoverable: true,
    };

    await setDoc(userRef, {
      ...newProfile,
      serverCreatedAt: serverTimestamp(),
    });

    return newProfile;
  },

  /**
   * Google Sign-in with popup and redirect fallback
   */
  async signInWithGoogle(): Promise<void> {
    if (!isFirebaseConfigured() || !auth) {
      // Demo / Mock sign in
      const mockProfile: UserProfile = {
        uid: 'demo_user_krish',
        displayName: 'Krishnendu Pal',
        email: 'krishnendu@splitify.app',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        username: 'krish',
        createdAt: Date.now(),
        preferences: { theme: 'system', currency: 'INR' },
        discoverable: true,
      };
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mockProfile));
      window.dispatchEvent(new Event('storage'));
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        GoogleAuth.initialize({
          clientId: '268134159684-91qvrjihpdui4rrdsd8irfv4vq2u99a5.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: false,
        });
      } catch {
        // Initialization can be safely re-attempted
      }
      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser?.authentication?.idToken;
      if (!idToken) {
        throw new Error('Google Sign-In did not return an authentication token.');
      }
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (popupError: any) {
      console.warn('[Splitify] Popup blocked or failed, falling back to redirect:', popupError);
      if (
        popupError?.code === 'auth/popup-blocked' ||
        popupError?.code === 'auth/popup-closed-by-user' ||
        popupError?.code === 'auth/cancelled-popup-request'
      ) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        throw popupError;
      }
    }
  },

  /**
   * Demo quick login with a choice of mock persona (great for testing 3-person multi-user scenarios!)
   */
  async signInWithDemoPersona(persona: 'krish' | 'rahul' | 'priya'): Promise<UserProfile> {
    const personas: Record<string, UserProfile> = {
      krish: {
        uid: 'demo_user_krish',
        displayName: 'Krishnendu Pal',
        email: 'krish@splitify.app',
        photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        username: 'krish',
        createdAt: Date.now(),
        preferences: { theme: 'system', currency: 'INR' },
        discoverable: true,
      },
      rahul: {
        uid: 'demo_user_rahul',
        displayName: 'Rahul Sharma',
        email: 'rahul@splitify.app',
        photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        username: 'rahul',
        createdAt: Date.now(),
        preferences: { theme: 'system', currency: 'INR' },
        discoverable: true,
      },
      priya: {
        uid: 'demo_user_priya',
        displayName: 'Priya Patel',
        email: 'priya@splitify.app',
        photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        username: 'priya',
        createdAt: Date.now(),
        preferences: { theme: 'system', currency: 'INR' },
        discoverable: true,
      },
    };

    const selected = personas[persona] || personas.krish;
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(selected));
    window.dispatchEvent(new Event('storage'));
    return selected;
  },

  /**
   * Update profile information
   */
  async updateProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    if (!isFirebaseConfigured() || !db) {
      const current = localStorage.getItem(MOCK_STORAGE_KEY);
      if (current) {
        const profile = { ...JSON.parse(current), ...updates };
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(profile));
        window.dispatchEvent(new Event('storage'));
      }
      return;
    }

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, updates);
  },

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    localStorage.removeItem(MOCK_STORAGE_KEY);
    window.dispatchEvent(new Event('storage'));
    if (Capacitor.isNativePlatform()) {
      try {
        await GoogleAuth.signOut();
      } catch {
        // Ignore native sign out error
      }
    }
    if (isFirebaseConfigured() && auth) {
      await fbSignOut(auth);
    }
  },
};
