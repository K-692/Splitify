import {
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  updateProfile as fbUpdateProfile,
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
const GOOGLE_WEB_CLIENT_ID = '268134159684-91qvrjihpdui4rrdsd8irfv4vq2u99a5.apps.googleusercontent.com';

let isNativeGoogleAuthInitialized = false;
let nativeGoogleAuthInitPromise: Promise<void> | null = null;

/**
 * Initializes the native Google authentication plugin once per application session.
 * Guaranteed to be a no-op on the web platform.
 */
export async function initializeNativeGoogleAuth(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  if (isNativeGoogleAuthInitialized) {
    return;
  }
  if (nativeGoogleAuthInitPromise) {
    return nativeGoogleAuthInitPromise;
  }

  nativeGoogleAuthInitPromise = (async () => {
    try {
      console.log('[Splitify Native Auth] Initializing GoogleAuth plugin with client ID:', GOOGLE_WEB_CLIENT_ID);
      await GoogleAuth.initialize({
        clientId: GOOGLE_WEB_CLIENT_ID,
        scopes: ['profile', 'email'],
        grantOfflineAccess: false,
      });
      isNativeGoogleAuthInitialized = true;
      console.log('[Splitify Native Auth] GoogleAuth plugin initialized successfully.');
    } catch (initErr: any) {
      console.error('[Splitify Native Auth] GoogleAuth plugin initialization failed:', initErr);
      isNativeGoogleAuthInitialized = false;
      throw new Error(
        `Failed to initialize native Google authentication: ${initErr?.message || String(initErr)}`
      );
    } finally {
      nativeGoogleAuthInitPromise = null;
    }
  })();

  return nativeGoogleAuthInitPromise;
}

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
        const fallbackPhoto =
          fbUser.photoURL ||
          fbUser.providerData?.find((p) => p.photoURL)?.photoURL ||
          undefined;
        callback({
          uid: fbUser.uid,
          displayName: fallbackName,
          email: fbUser.email || '',
          photoURL: fallbackPhoto,
          createdAt: Date.now(),
        });
      }
    });
  },

  /**
   * Fetch or create user profile in Firestore, ensuring Google profile photo is always preserved and synced
   */
  async getOrCreateProfile(fbUser: FirebaseUser, overridePhotoURL?: string): Promise<UserProfile> {
    if (!db) throw new Error('Firestore not initialized');

    // Prioritize explicitly passed photoURL (e.g. from native GoogleAuth.imageUrl), then fbUser.photoURL, then providerData
    const resolvedPhotoURL =
      overridePhotoURL ||
      fbUser.photoURL ||
      fbUser.providerData?.find((p) => p.photoURL)?.photoURL ||
      undefined;

    const userRef = doc(db, 'users', fbUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const existingData = snap.data() as UserProfile;
      // If Firestore profile is missing photoURL or has a new photoURL from Google, sync it!
      if (resolvedPhotoURL && (!existingData.photoURL || (overridePhotoURL && existingData.photoURL !== overridePhotoURL))) {
        existingData.photoURL = resolvedPhotoURL;
        updateDoc(userRef, { photoURL: resolvedPhotoURL }).catch((err) =>
          console.warn('[Splitify] Could not sync photoURL to Firestore:', err)
        );
      }
      return existingData;
    }

    // Default to the first name from Gmail display name or email username
    const rawName = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
    const initialFirstName = getFirstName(rawName);

    const newProfile: UserProfile = {
      uid: fbUser.uid,
      displayName: initialFirstName,
      email: fbUser.email || '',
      photoURL: resolvedPhotoURL,
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
      // 1. Ensure plugin is initialized before attempting sign-in
      await initializeNativeGoogleAuth();

      // 2. Invoke native Google Sign-In
      console.log('[Splitify Native Auth] Invoking GoogleAuth.signIn()...');
      let googleUser: any;
      try {
        googleUser = await GoogleAuth.signIn();
      } catch (signInErr: any) {
        console.error('[Splitify Native Auth] GoogleAuth.signIn() caught error:', signInErr);
        const code = String(signInErr?.code || signInErr?.message || '');
        if (code === '12501' || signInErr?.message?.includes('canceled') || signInErr?.message?.includes('cancelled')) {
          const cancelError: any = new Error('The user canceled the sign-in flow.');
          cancelError.code = '12501';
          cancelError.isCanceled = true;
          throw cancelError;
        }
        throw signInErr;
      }

      // 3. Verify that Google ID token is present
      const idToken = googleUser?.authentication?.idToken;
      if (!idToken) {
        console.error('[Splitify Native Auth] Missing idToken in authentication payload:', googleUser);
        throw new Error('Google Sign-In completed but no valid ID token was returned.');
      }

      // 4. Exchange Google ID token for Firebase credential
      console.log('[Splitify Native Auth] Exchanging Google ID token with Firebase Auth...');
      try {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        console.log('[Splitify Native Auth] Firebase authentication succeeded for UID:', userCredential.user.uid);

        // 5. Propagate Google profile photo URL
        const photoURL =
          googleUser?.imageUrl ||
          googleUser?.photoUrl ||
          userCredential.user.photoURL ||
          userCredential.user.providerData?.find((p) => p.photoURL)?.photoURL ||
          undefined;

        if (photoURL) {
          console.log('[Splitify Native Auth] Propagating Google profile photo:', photoURL);
          if (!userCredential.user.photoURL) {
            try {
              await fbUpdateProfile(userCredential.user, { photoURL });
            } catch (pErr) {
              console.warn('[Splitify Native Auth] Notice updating Firebase Auth user photoURL:', pErr);
            }
          }
          try {
            await authService.getOrCreateProfile(userCredential.user, photoURL);
          } catch (fsErr) {
            console.warn('[Splitify Native Auth] Notice syncing photoURL to Firestore:', fsErr);
          }
        }
        return;
      } catch (firebaseErr: any) {
        console.error('[Splitify Native Auth] Firebase signInWithCredential failed:', firebaseErr);
        throw new Error(`Firebase credential exchange failed: ${firebaseErr?.message || String(firebaseErr)}`);
      }
    }

    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const photoURL =
        userCredential.user.photoURL ||
        userCredential.user.providerData?.find((p) => p.photoURL)?.photoURL ||
        undefined;
      if (photoURL) {
        await authService.getOrCreateProfile(userCredential.user, photoURL);
      }
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
