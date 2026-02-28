import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getRecordByStudentId } from '@/firebase/records';
import type { StudentRecordDoc } from '@/types';
import type { AreaCompetency } from '@/api/competency';
import WordCloudSection from '@/components/dashboard/WordCloudSection';
import GraphSection from '@/components/dashboard/GraphSection';
import CompetencySection from '@/components/dashboard/CompetencySection';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { studentId } = useParams<{ studentId: string }>();
  const [doc, setDoc] = useState<StudentRecordDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [areaCompetency, setAreaCompetency] = useState<AreaCompetency[]>([]);

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

  const hasDrafts = doc.items.some((it) => it.draftContent);

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
          {hasDrafts && ` · 초안 ${doc.items.filter((i) => i.draftContent).length}건`}
        </p>
        <p className={styles.intro}>
          아래에서 워드 클라우드, 연결관계 그래프, 역량 진단을 실행하고, 저장된 기록·초안을 확인할 수 있습니다.
        </p>
      </header>

      <WordCloudSection items={doc.items} />
      <GraphSection items={doc.items} />
      <CompetencySection items={doc.items} onResult={(r) => setAreaCompetency(r.areaCompetency ?? [])} />

      <section className={styles.section} aria-labelledby="dashboard-records">
        <h2 id="dashboard-records" className={styles.sectionTitle}>기록 요약 (영역별)</h2>
        <p className={styles.hint}>
          영역별 기록 내용 요약과 역량 관련성(학업·진로·공동체 %)을 확인할 수 있습니다. 역량 분석을 실행하면 퍼센트가 채워집니다.
        </p>
        {Object.entries(byArea).map(([area, list]) => {
          const ac = areaCompetency.find((a) => a.area === area);
          return (
          <div key={area} className={styles.block}>
            <h3>{area} ({list.length}건)</h3>
            {ac && (
              <div className={styles.areaCompetency}>
                {ac.summary && <p className={styles.areaSummary}>{ac.summary}</p>}
                <div className={styles.areaPercents}>
                  <span>학업역량 <strong>{ac.academic}%</strong></span>
                  <span>진로역량 <strong>{ac.career}%</strong></span>
                  <span>공동체역량 <strong>{ac.community}%</strong></span>
                </div>
              </div>
            )}
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>학년</th>
                  <th>구분</th>
                  <th>내용</th>
                  {hasDrafts && <th>초안</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((it, i) => (
                  <tr key={i}>
                    <td>{it.grade ? `${it.grade}학년` : '-'}</td>
                    <td>{it.subCategory || it.label || '-'}</td>
                    <td className={styles.cellContent}>{it.content}</td>
                    {hasDrafts && (
                      <td className={styles.cellContent}>{it.draftContent ?? '-'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          );
        })}
      </section>
    </div>
  );
}
