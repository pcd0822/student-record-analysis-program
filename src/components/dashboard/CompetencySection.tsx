import { useState, useCallback } from 'react';
import { analyzeCompetency } from '@/api/competency';
import type { RecordItem } from '@/types';
import type { CompetencyResult } from '@/api/competency';
import styles from './CompetencySection.module.css';

interface Props {
  items: RecordItem[];
  onResult?: (result: CompetencyResult) => void;
}

export default function CompetencySection({ items, onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompetencyResult | null>(null);

  const run = useCallback(() => {
    if (items.length === 0) {
      setError('항목이 없습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    analyzeCompetency(items)
      .then((data) => {
        setResult(data);
        onResult?.(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '분석 실패'))
      .finally(() => setLoading(false));
  }, [items, onResult]);

  return (
    <section className={styles.section}>
      <h2>역량 진단 · 점수 · 보완 방향</h2>
      <p className={styles.hint}>
        학종 3역량(학업역량, 진로역량, 공동체역량) 기준으로 생기부를 진단하고, 역량별 점수와 보완 방향을 한 번에 제공합니다.
      </p>
      <button type="button" onClick={run} disabled={loading || items.length === 0} className={styles.btn}>
        {loading ? '분석 중…' : '역량 분석 실행'}
      </button>
      {error && <p className={styles.error}>{error}</p>}
      {result && (
        <div className={styles.result}>
          {result.summary != null && result.summary !== '' && (
            <div className={styles.block}>
              <h3>전체 요약</h3>
              <p className={styles.summary}>{String(result.summary)}</p>
            </div>
          )}
          {Array.isArray(result.competencies) && result.competencies.length > 0 && (
            <div className={styles.block}>
              <h3>역량 진단</h3>
              <ul className={styles.list}>
                {(result.competencies as { name?: string; level?: string; evidence?: string }[]).map((c, i) => (
                  <li key={i}>
                    <strong>{c.name}</strong> {c.level && `(${c.level})`} — {c.evidence}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(result.scores) && result.scores.length > 0 && (
            <div className={styles.block}>
              <h3>역량별 점수</h3>
              <ul className={styles.list}>
                {(result.scores as { name?: string; score?: number; brief?: string }[]).map((s, i) => (
                  <li key={i}>
                    <strong>{s.name}</strong> {typeof s.score === 'number' && `${s.score}점`} — {s.brief}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(result.suggestions) && result.suggestions.length > 0 && (
            <div className={styles.block}>
              <h3>보완 방향</h3>
              <ul className={styles.list}>
                {(result.suggestions as { competency?: string; activities?: { area?: string; description?: string }[] }[]).map((s, i) => (
                  <li key={i}>
                    <strong>{s.competency}</strong>
                    <ul>
                      {(s.activities || []).map((a, j) => (
                        <li key={j}>{a.area}: {a.description}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!result.summary && !(Array.isArray(result.competencies) && result.competencies.length) && !(Array.isArray(result.scores) && result.scores.length) && !(Array.isArray(result.suggestions) && result.suggestions.length) && (
            <pre className={styles.raw}>{JSON.stringify(result, null, 2)}</pre>
          )}
        </div>
      )}
    </section>
  );
}
