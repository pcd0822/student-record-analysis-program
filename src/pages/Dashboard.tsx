import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getRecordByStudentId } from '@/firebase/records';
import type { StudentRecordDoc } from '@/types';
import WordCloudSection from '@/components/dashboard/WordCloudSection';
import GraphSection from '@/components/dashboard/GraphSection';
import CompetencySection from '@/components/dashboard/CompetencySection';
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/view" className={styles.back}>
          ← 조회 목록
        </Link>
        <h1 className={styles.title}>분석 대시보드</h1>
        <p className={styles.studentId}>학번 {studentId}</p>
        <p className={styles.meta}>
          업로드: {new Date(doc.uploadedAt).toLocaleString('ko-KR')}
          {' · '}총 {doc.items.length}건 기록
        </p>
        <p className={styles.intro}>
          워드 클라우드, 연결관계, 역량 진단이 자동으로 분석됩니다. 아래에서 결과를 확인하세요.
        </p>
      </header>

      <WordCloudSection items={doc.items} autoRun />
      <GraphSection items={doc.items} autoRun />
      <CompetencySection items={doc.items} autoRun />
    </div>
  );
}
