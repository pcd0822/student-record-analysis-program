import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getDb } from './config';
import type { StudentRecordDoc } from '@/types';

const RECORDS_COLLECTION = 'records';

export async function saveRecord(
  studentId: string,
  items: StudentRecordDoc['items'],
  createdBy: string
): Promise<void> {
  const db = getDb();
  const ref = doc(db, RECORDS_COLLECTION, studentId);
  const now = new Date().toISOString();
  const data: Omit<StudentRecordDoc, 'studentId'> & { studentId: string } = {
    studentId,
    uploadedAt: now,
    items,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
  await setDoc(ref, data);
}

export async function getRecordByStudentId(studentId: string): Promise<StudentRecordDoc | null> {
  const db = getDb();
  const ref = doc(db, RECORDS_COLLECTION, studentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as StudentRecordDoc;
}

export async function listStudentIds(createdBy?: string): Promise<{ studentId: string; uploadedAt: string }[]> {
  const db = getDb();
  const ref = collection(db, RECORDS_COLLECTION);
  const q = query(ref, orderBy('uploadedAt', 'desc'), limit(200));
  const snap = await getDocs(q);
  const list: { studentId: string; uploadedAt: string }[] = [];
  snap.docs.forEach((d) => {
    const data = d.data();
    if (createdBy && data.createdBy !== createdBy) return;
    list.push({
      studentId: data.studentId ?? d.id,
      uploadedAt: data.uploadedAt ?? '',
    });
  });
  return list;
}
