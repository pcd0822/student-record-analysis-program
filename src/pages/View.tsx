import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listStudentIds } from '@/firebase/records';
import { getAuthInstance } from '@/firebase/config';
import styles from './View.module.css';

interface ListItem {
  studentId: string;
  uploadedAt: string;
}

export default function View() {
  const [list, setList] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const user = getAuthInstance().currentUser;
    if (!user) return;
    listStudentIds(user.uid)
      .then(setList)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    import('@/firebase/records')
      .then(({ getRecordByStudentId }) => getRecordByStudentId(selectedId))
      .then((doc) => {
        setDetail(doc ?? null);
      })
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return d.toLocaleString('ko-KR');
    } catch {
      return iso;
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.section}>
        <h2>생기부 조회</h2>
        <p className={styles.hint}>학번을 클릭하면 해당 생기부 로우 데이터를 볼 수 있습니다.</p>
        {loading ? (
          <p>목록 불러오는 중…</p>
        ) : list.length === 0 ? (
          <p className={styles.empty}>저장된 생기부가 없습니다. 업로드 탭에서 먼저 등록해 주세요.</p>
        ) : (
          <div className={styles.layout}>
            <div className={styles.listPanel}>
              <ul className={styles.list}>
                {list.map(({ studentId, uploadedAt }) => (
                  <li key={studentId}>
                    <button
                      type="button"
                      className={selectedId === studentId ? styles.selected : ''}
                      onClick={() => setSelectedId(studentId)}
                    >
                      <span className={styles.id}>{studentId}</span>
                      <span className={styles.date}>{formatDate(uploadedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.detailPanel}>
              {!selectedId && (
                <p className={styles.placeholder}>학번을 선택하세요.</p>
              )}
              {selectedId && loadingDetail && (
                <p>로딩 중…</p>
              )}
              {selectedId && !loadingDetail && detail && (
                <>
                  <div className={styles.detailHeader}>
                    <span>학번: {selectedId}</span>
                    <Link to={`/dashboard/${selectedId}`} className={styles.dashboardLink}>
                      분석 대시보드 →
                    </Link>
                  </div>
                  <pre className={styles.rawJson}>{JSON.stringify(detail, null, 2)}</pre>
                </>
              )}
              {selectedId && !loadingDetail && !detail && (
                <p>해당 학번의 데이터를 찾을 수 없습니다.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
