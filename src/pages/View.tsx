import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { listStudentIds } from '@/firebase/records';
import { getAuthInstance } from '@/firebase/config';
import styles from './View.module.css';

interface ListItem {
  studentId: string;
  uploadedAt: string;
}

function fetchList(): Promise<ListItem[]> {
  const user = getAuthInstance().currentUser;
  if (!user) return Promise.resolve([]);
  return listStudentIds(user.uid);
}

export default function View() {
  const [list, setList] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<unknown | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const location = useLocation();

  const loadList = useCallback(() => {
    setListError(null);
    setLoading(true);
    fetchList()
      .then(setList)
      .catch((e) => setListError(e instanceof Error ? e.message : '목록을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (location.pathname !== '/view') return;
    loadList();
  }, [location.pathname, loadList]);

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
        {listError && (
          <p className={styles.error}>
            {listError}
            <button type="button" className={styles.refreshBtn} onClick={loadList}>
              다시 시도
            </button>
          </p>
        )}
        {loading ? (
          <p>목록 불러오는 중…</p>
        ) : !listError && list.length === 0 ? (
          <p className={styles.empty}>저장된 생기부가 없습니다. 업로드 탭에서 먼저 등록해 주세요.</p>
        ) : !listError ? (
          <div className={styles.layout}>
            <div className={styles.listPanel}>
              <div className={styles.listHeader}>
                <span>학번 목록</span>
                <button type="button" className={styles.refreshBtn} onClick={loadList} disabled={loading}>
                  새로고침
                </button>
              </div>
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
              {selectedId && !loadingDetail && detail !== null ? (
                <>
                  <div className={styles.detailHeader}>
                    <span>학번: {selectedId}</span>
                    <Link to={`/dashboard/${selectedId}`} className={styles.dashboardLink}>
                      분석 대시보드 →
                    </Link>
                  </div>
                  <pre className={styles.rawJson}>{JSON.stringify(detail, null, 2)}</pre>
                </>
              ) : null}
              {selectedId && !loadingDetail && !detail && (
                <p>해당 학번의 데이터를 찾을 수 없습니다.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
