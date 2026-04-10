import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  Auth,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../constants';
import { Request, FormData } from '../types';
import { calculatePoints } from '../utils';

let app: any;
let auth: Auth | null = null;
let db: Firestore | null = null;

export const initFirebase = (config?: typeof FIREBASE_CONFIG) => {
  try {
    const finalConfig = config || FIREBASE_CONFIG;
    if (finalConfig.apiKey) {
      app = initializeApp(finalConfig);
      auth = getAuth(app);
      db = getFirestore(app);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return false;
  }
};

export const initAuth = async (customToken?: string): Promise<User | null> => {
  if (!auth) return null;

  try {
    if (customToken) {
      await signInWithCustomToken(auth, customToken);
    } else {
      await signInAnonymously(auth);
    }
    return auth.currentUser;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
};

export const onAuthChange = (callback: (user: User | null) => void): void => {
  if (!auth) return;
  onAuthStateChanged(auth, callback);
};

export const addRequest = async (formData: FormData): Promise<string | null> => {
  if (!db) {
    console.error('Database not initialized');
    return null;
  }

  try {
    const pointsData = calculatePoints(formData);
    const payload = {
      ...formData,
      ...pointsData,
      fechaRegistro: new Date().toISOString(),
    };

    const appId = 'escalafon-udes-rectangular-v5';
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'solicitudes');
    const docRef = await addDoc(q, payload);
    return docRef.id;
  } catch (error) {
    console.error('Error adding request:', error);
    return null;
  }
};

export const deleteRequest = async (docId: string): Promise<boolean> => {
  if (!db) {
    console.error('Database not initialized');
    return false;
  }

  try {
    const appId = 'escalafon-udes-rectangular-v5';
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'solicitudes', docId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Error deleting request:', error);
    return false;
  }
};

export const subscribeToRequests = (
  callback: (requests: Request[]) => void
): Unsubscribe | null => {
  if (!db) {
    console.error('Database not initialized');
    return null;
  }

  try {
    const appId = 'escalafon-udes-rectangular-v5';
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'solicitudes');

    return onSnapshot(
      q,
      (snapshot) => {
        const requests = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Request[];
        callback(requests);
      },
      (error) => {
        console.error('Firestore snapshot error:', error);
        callback([]);
      }
    );
  } catch (error) {
    console.error('Error subscribing to requests:', error);
    return null;
  }
};
