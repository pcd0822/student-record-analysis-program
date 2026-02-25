import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getRecordByStudentId } from '@/firebase/records';
import type { StudentRecordDoc } from '@/types';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { studentId } = useParams<{ studentId: string }>();
  const [doc, setDoc] = useState<StudentRecordDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    getRecordByStudentId(studentId)
      .then(setDoc)
      .finally(() => setLoading(false));
  }, [studentId]);

  if (!studentId) {
    return (
      <div className={styles.page}>
        <p>학번이 없습니다.</p>
        <Link to="/view">조회 목록으로</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p>로딩 중…</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className={styles.page}>
        <p>해당 학번의 데이터를 찾을 수 없습니다.</p>
        <Link to="/view">조회 목록으로</Link>
      </div>
    );
  }

  const byArea = doc.items.reduce<Record<string, typeof doc.items>>((acc, it) => {
    const key = it.area || '기타';
    if (!acc[key]) acc[key] = [];
    acc[key].push(it);
    return acc;
  }, {});

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link to="/view" className={styles.back}>
          ← 조회
        </Link>
        <h1>분석 대시보드 · 학번 {studentId}</h1>
        <p className={styles.meta}>
          업로드: {new Date(doc.uploadedAt).toLocaleString('ko-KR')}
        </p>
      </div>

      <section className={styles.section}>
        <h2>기록 요약 (영역별)</h2>
        <p className={styles.hint}>
          워드 클라우드, 연결관계 그래프, 역량 진단 등은 다음 단계에서 추가됩니다.
        </p>
        {Object.entries(byArea).map(([area, list]) => (
          <div key={area} className={styles.block}>
            <h3>{area} ({list.length}건)</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>학년</th>
                  <th>구분</th>
                  <th>내용</th>
                </tr>
              </thead>
              <tbody>
                {list.map((it, i) => (
                  <tr key={i}>
                    <td>{it.grade ? `${it.grade}학년` : '-'}</td>
                    <td>{it.subCategory || it.label || '-'}</td>
                    <td className={styles.cellContent}>{it.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </div>
  );
}
