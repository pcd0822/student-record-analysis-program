import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

export function initFirebase() {
  if (app) return { app, auth, db };
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  return { app, auth, db };
}

export function getAuthInstance(): Auth {
  if (!auth) initFirebase();
  return auth;
}

export function getDb(): Firestore {
  if (!db) initFirebase();
  return db;
}

export { GoogleAuthProvider };
