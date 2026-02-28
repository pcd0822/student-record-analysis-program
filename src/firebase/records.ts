import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getDb } from './config';
import type { StudentRecordDoc } from '@/types';

const RECORDS_COLLECTION = 'records';

/** Firestore는 undefined 값을 허용하지 않음. 저장 전 제거 */
function removeUndefined<T>(value: T): T {
  if (value === undefined) return value;
  if (Array.isArray(value)) return value.map(removeUndefined) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = removeUndefined(v);
    }
    return out as T;
  }
  return value;
}

export async function saveRecord(
  studentId: string,
  items: StudentRecordDoc['items'],
  createdBy: string
): Promise<void> {
  const db = getDb();
  const ref = doc(db, RECORDS_COLLECTION, studentId);
  const now = new Date().toISOString();
  const data = removeUndefined({
    studentId,
    uploadedAt: now,
    items,
    createdAt: now,
    updatedAt: now,
    createdBy,
  });
  await setDoc(ref, data);
}

export async function getRecordByStudentId(studentId: string): Promise<StudentRecordDoc | null> {
  const db = getDb();
  const ref = doc(db, RECORDS_COLLECTION, studentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as StudentRecordDoc;
}

export async function listStudentIds(createdBy: string): Promise<{ studentId: string; uploadedAt: string }[]> {
  const db = getDb();
  const ref = collection(db, RECORDS_COLLECTION);
  const q = query(
    ref,
    where('createdBy', '==', createdBy),
    orderBy('uploadedAt', 'desc'),
    limit(200)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      studentId: data.studentId ?? d.id,
      uploadedAt: data.uploadedAt ?? '',
    };
  });
}
