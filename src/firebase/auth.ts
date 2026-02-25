import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getAuthInstance, getDb, GoogleAuthProvider } from './config';

const ALLOWED_USERS_COLLECTION = 'allowedUsers';

/** 승인된 사용자만 사용 가능 — Firestore allowedUsers/{uid} 문서 존재 여부로 판단 */
export async function isUserAllowed(uid: string): Promise<boolean> {
  const db = getDb();
  const ref = doc(db, ALLOWED_USERS_COLLECTION, uid);
  const snap = await getDoc(ref);
  return snap.exists();
}

export function signInWithGoogle(): Promise<User | null> {
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider).then((r) => r.user);
}

export function signOut(): Promise<void> {
  const auth = getAuthInstance();
  return fbSignOut(auth);
}

export function subscribeAuth(cb: (user: User | null) => void): Unsubscribe {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, cb);
}
