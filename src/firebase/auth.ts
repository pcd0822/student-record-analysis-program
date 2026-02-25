import {
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getAuthInstance, getDb, GoogleAuthProvider } from './config';

const ALLOWED_USERS_COLLECTION = 'allowedUsers';
const ALLOWED_EMAILS_COLLECTION = 'allowedEmails';

/** 승인된 사용자만 사용 가능 — allowedUsers/{uid} 또는 allowedEmails/{이메일} 문서 존재 여부로 판단 */
export async function isUserAllowed(user: User): Promise<boolean> {
  const db = getDb();
  const uidRef = doc(db, ALLOWED_USERS_COLLECTION, user.uid);
  const uidSnap = await getDoc(uidRef);
  if (uidSnap.exists()) return true;
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  const emailRef = doc(db, ALLOWED_EMAILS_COLLECTION, email);
  const emailSnap = await getDoc(emailRef);
  return emailSnap.exists();
}

/** 구글 로그인 — 리다이렉트 방식(COOP 오류 방지) */
export function signInWithGoogle(): void {
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  signInWithRedirect(auth, provider);
}

/** 리다이렉트 결과는 페이지당 한 번만 소비되므로 캐시 (여러 컴포넌트/StrictMode 대응) */
let redirectResultPromise: Promise<User | null> | null = null;

/** 리다이렉트 후 돌아왔을 때 결과 처리. 앱 전체에서 한 번만 실제 호출됨 */
export function handleRedirectResult(): Promise<User | null> {
  if (redirectResultPromise !== null) return redirectResultPromise;
  const auth = getAuthInstance();
  redirectResultPromise = getRedirectResult(auth).then((result) => result?.user ?? null);
  return redirectResultPromise;
}

export function signOut(): Promise<void> {
  const auth = getAuthInstance();
  return fbSignOut(auth);
}

export function subscribeAuth(cb: (user: User | null) => void): Unsubscribe {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, cb);
}
