import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const injectedConfig = (() => {
  const raw = (globalThis as any).__initial_firebase_config;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
})();

export const appId: string = (globalThis as any).__app_id || 'escalafon-udes-v1';
export const initialAuthToken: string = (globalThis as any).__initial_auth_token || '';

let _db: Firestore | null = null;
let _auth: Auth | null = null;
let _storage: FirebaseStorage | null = null;

if ((injectedConfig as any)?.apiKey) {
  const app: FirebaseApp = initializeApp(injectedConfig);
  _auth = getAuth(app);
  _db = getFirestore(app);
  _storage = getStorage(app);
}

export const db: Firestore | null = _db;
export const auth: Auth | null = _auth;
export const storage: FirebaseStorage | null = _storage;
