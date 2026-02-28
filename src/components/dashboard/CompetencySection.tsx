import { useState, useCallback, useEffect } from 'react';
import { analyzeCompetency } from '@/api/competency';
import type { RecordItem } from '@/types';
import type { CompetencyResult } from '@/api/competency';
import styles from './CompetencySection.module.css';

interface Props {
  items: RecordItem[];
  onResult?: (result: CompetencyResult) => void;
  autoRun?: boolean;
}

const COMPETENCY_COLORS: Record<string, string> = {
  학업역량: '#93c5fd',
  진로역량: '#86efac',
  공동체역량: '#fde047',
};

export default function CompetencySection({ items, onResult, autoRun = true }: Props) {
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

  useEffect(() => {
    if (autoRun && items.length > 0 && !result && !loading && !error) run();
  }, [autoRun, items.length, run, result, loading, error]);

  const scores = (result?.scores || []) as { name?: string; score?: number; brief?: string }[];
  const suggestions = (result?.suggestions || []) as { competency?: string; activities?: { area?: string; description?: string }[] }[];

  return (
    <section className={styles.section}>
      <h2>역량 진단 · 점수 · 보완 방향</h2>
      <p className={styles.hint}>
        학종 3역량 기준으로 진단합니다. 영역 내 구체적인 활동별 역량 비율과 보완 방향을 확인할 수 있습니다.
      </p>
      {loading && <p className={styles.loading}>역량 분석 중…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {result && (
        <div className={styles.result}>
          {result.summary != null && result.summary !== '' && (
            <div className={styles.block}>
              <h3>전체 요약</h3>
              <p className={styles.summary}>{String(result.summary)}</p>
            </div>
          )}
          {scores.length > 0 && (
            <div className={styles.block}>
              <h3>역량별 점수 (퍼센트)</h3>
              <div className={styles.barChart}>
                {scores.map((s, i) => {
                  const score = typeof s.score === 'number' ? s.score : 0;
                  const color = COMPETENCY_COLORS[s.name ?? ''] ?? '#6b7280';
                  return (
                    <div key={i} className={styles.barRow}>
                      <span className={styles.barLabel}>{s.name}</span>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{ width: `${score}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className={styles.barValue}>{score}%</span>
                      {s.brief && <span className={styles.barBrief} style={{ borderLeftColor: color }}>{s.brief}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {(Array.isArray(result.activityCompetency) ? result.activityCompetency : result.areaCompetency)?.length ? (
            <div className={styles.block}>
              <h3>활동별 역량 (기록 ↔ 점수)</h3>
              <div className={styles.recordCompetencyLayout}>
                {(result.activityCompetency ?? result.areaCompetency ?? []).map((ac, i) => (
                  <div key={i} className={styles.recordCompetencyRow}>
                    <div className={styles.recordSide}>
                      <strong>{ac.area}{ac.sub ? ` · ${ac.sub}` : ''}</strong>
                      {ac.summary && <p>{ac.summary}</p>}
                    </div>
                    <div className={styles.scoreSide}>
                      <div className={styles.miniBars}>
                        <span title="학업역량" style={{ color: COMPETENCY_COLORS.학업역량 }}>학업 {ac.academic}%</span>
                        <span title="진로역량" style={{ color: COMPETENCY_COLORS.진로역량 }}>진로 {ac.career}%</span>
                        <span title="공동체역량" style={{ color: COMPETENCY_COLORS.공동체역량 }}>공동체 {ac.community}%</span>
                      </div>
                      <div className={styles.miniBarBars}>
                        <div className={styles.miniBar} style={{ width: `${ac.academic}%`, backgroundColor: COMPETENCY_COLORS.학업역량 }} />
                        <div className={styles.miniBar} style={{ width: `${ac.career}%`, backgroundColor: COMPETENCY_COLORS.진로역량 }} />
                        <div className={styles.miniBar} style={{ width: `${ac.community}%`, backgroundColor: COMPETENCY_COLORS.공동체역량 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {Array.isArray(result.competencies) && result.competencies.length > 0 && (
            <div className={styles.block}>
              <h3>역량 진단</h3>
              <ul className={styles.list}>
                {(result.competencies as { name?: string; level?: string; evidence?: string }[]).map((c, i) => (
                  <li key={i}>
                    <span className={styles.compBullet} style={{ backgroundColor: COMPETENCY_COLORS[c.name ?? ''] ?? '#6b7280' }} />
                    <strong>{c.name}</strong> {c.level && `(${c.level})`} — {c.evidence}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className={styles.block}>
              <h3>보완 방향 · 특장점</h3>
              <ul className={styles.suggestionList}>
                {suggestions.map((s, i) => {
                  const color = COMPETENCY_COLORS[s.competency ?? ''] ?? '#6b7280';
                  return (
                    <li key={i} className={styles.suggestionItem}>
                      <span className={styles.compBullet} style={{ backgroundColor: color }} />
                      <strong>{s.competency}</strong>
                      <ul>
                        {(s.activities || []).map((a, j) => (
                          <li key={j}>{a.area}: {a.description}</li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {!result.summary && !(Array.isArray(result.competencies) && result.competencies.length) && !(result.scores?.length) && !(result.activityCompetency?.length) && !(result.areaCompetency?.length) && !suggestions.length && (
            <pre className={styles.raw}>{JSON.stringify(result, null, 2)}</pre>
          )}
        </div>
      )}
    </section>
  );
}
