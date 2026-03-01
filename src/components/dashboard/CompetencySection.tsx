import { useState, useCallback, useEffect } from 'react';
import { analyzeCompetency } from '@/api/competency';
import type { RecordItem } from '@/types';
import type { CompetencyResult, ActivityCompetency } from '@/api/competency';
import styles from './CompetencySection.module.css';

interface Props {
  items: RecordItem[];
  onResult?: (result: CompetencyResult) => void;
  autoRun?: boolean;
}

const COMPETENCY_COLORS: Record<string, string> = {
  학업역량: '#93c5fd',
  진로역량: '#86efac',
  공동체역량: '#f9a8a8',
};

/** 원 그래프 SVG (scores: 학업, 진로, 공동체 비율) */
function PieChart({ scores }: { scores: { name?: string; score?: number }[] }) {
  const total = scores.reduce((s, x) => s + (typeof x.score === 'number' ? x.score : 0), 0);
  if (total <= 0) return null;
  const r = 64;
  const cx = 80;
  const cy = 80;
  let offset = -90;
  const paths = scores.map((s) => {
    const val = (typeof s.score === 'number' ? s.score : 0) / total;
    const sweep = val * 360;
    const start = offset;
    offset += sweep;
    const x1 = cx + r * Math.cos((start * Math.PI) / 180);
    const y1 = cy + r * Math.sin((start * Math.PI) / 180);
    const x2 = cx + r * Math.cos(((start + sweep) * Math.PI) / 180);
    const y2 = cy + r * Math.sin(((start + sweep) * Math.PI) / 180);
    const large = sweep > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    const color = COMPETENCY_COLORS[s.name ?? ''] ?? '#94a3b8';
    return { d, color, name: s.name, score: s.score };
  });

  return (
    <div className={styles.pieWrap}>
      <svg viewBox="0 0 160 160" className={styles.pieSvg}>
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} stroke="#fff" strokeWidth="2" />
        ))}
      </svg>
      <div className={styles.pieLegend}>
        {paths.map((p, i) => (
          <div key={i} className={styles.pieLegendItem}>
            <span className={styles.pieDot} style={{ backgroundColor: p.color }} />
            <span>{p.name} {typeof p.score === 'number' ? `${p.score}%` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CompetencySection({ items, onResult, autoRun = true }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompetencyResult | null>(null);
  const [referenceMaterials, setReferenceMaterials] = useState('');

  const run = useCallback(() => {
    if (items.length === 0) {
      setError('항목이 없습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    analyzeCompetency(items, { referenceMaterials: referenceMaterials.trim() || undefined })
      .then((data) => {
        setResult(data);
        onResult?.(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '분석 실패'))
      .finally(() => setLoading(false));
  }, [items, onResult, referenceMaterials]);

  useEffect(() => {
    if (autoRun && items.length > 0 && !result && !loading && !error) run();
  }, [autoRun, items.length, run, result, loading, error]);

  const scores = (result?.scores || []) as { name?: string; score?: number; brief?: string }[];
  const activityList = (result?.activityCompetency ?? result?.areaCompetency ?? []) as ActivityCompetency[];
  const suggestions = (result?.suggestions || []) as { area?: string; activities?: { description?: string }[] }[];

  return (
    <section className={styles.section}>
      <h2><span className={styles.icon}>🎯</span> 역량 진단 · 점수 · 보완 방향</h2>
      <p className={styles.hint}>
        학종 3역량 기준으로 진단합니다. 참고 자료를 입력하면 역량 점수 측정 시 반드시 참고합니다.
      </p>

      <div className={styles.referenceBlock}>
        <label className={styles.referenceLabel}>
          참고 자료 (Google Drive 폴더 링크 또는 자료 요약)
          <span className={styles.referenceNote}>입력 시 역량 점수 측정에 반드시 참고됩니다.</span>
        </label>
        <textarea
          className={styles.referenceTextarea}
          placeholder="예: 구글 드라이브 폴더 링크 또는 참고할 자료의 요약 텍스트를 붙여넣으세요."
          value={referenceMaterials}
          onChange={(e) => setReferenceMaterials(e.target.value)}
          rows={3}
        />
        <button type="button" className={styles.reanalyzeBtn} onClick={run} disabled={loading}>
          {loading ? '분석 중…' : '다시 분석'}
        </button>
      </div>

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
              <h3>역량별 점수 총점</h3>
              <div className={styles.pieSection}>
                <PieChart scores={scores} />
                <div className={styles.scoreBriefs}>
                  {scores.map((s, i) => (
                    <p key={i} style={{ borderLeftColor: COMPETENCY_COLORS[s.name ?? ''] ?? '#94a3b8' }}>
                      <strong>{s.name}</strong> {s.brief}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activityList.length > 0 && (
            <div className={styles.block}>
              <h3>활동별 역량 (학년 · 영역 · 세부 영역)</h3>
              <div className={styles.tableWrap}>
                <table className={styles.activityTable}>
                  <thead>
                    <tr>
                      <th>학년</th>
                      <th>영역</th>
                      <th>세부 영역</th>
                      <th>내용 요약</th>
                      <th>학업</th>
                      <th>진로</th>
                      <th>공동체</th>
                      <th>특징 피드백</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityList.map((ac, i) => (
                      <tr key={i}>
                        <td>{ac.grade ? `${ac.grade}학년` : '-'}</td>
                        <td>{ac.area}</td>
                        <td>{ac.sub ?? '-'}</td>
                        <td className={styles.cellSummary}>{ac.summary || '-'}</td>
                        <td><span style={{ color: COMPETENCY_COLORS.학업역량 }}>{ac.academic}%</span></td>
                        <td><span style={{ color: COMPETENCY_COLORS.진로역량 }}>{ac.career}%</span></td>
                        <td><span style={{ color: COMPETENCY_COLORS.공동체역량 }}>{ac.community}%</span></td>
                        <td className={styles.cellFeedback}>{ac.feedback || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
              <h3>보완 방향 · 영역별 구체적 탐구활동</h3>
              <ul className={styles.suggestionList}>
                {suggestions.map((s, i) => (
                  <li key={i} className={styles.suggestionItem}>
                    <strong className={styles.suggestionArea}>{s.area}</strong>
                    <ul>
                      {(s.activities || []).map((a, j) => (
                        <li key={j}>{a.description}</li>
                      ))}
                    </ul>
                  </li>
                ))}
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
