import { useState, useCallback } from 'react';
import { analyzeCompetency, type CompetencyMode } from '@/api/competency';
import type { RecordItem } from '@/types';
import styles from './CompetencySection.module.css';

interface Props {
  items: RecordItem[];
}

export default function CompetencySection({ items }: Props) {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<CompetencyMode>('diagnosis');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const run = useCallback(() => {
    if (items.length === 0) {
      setError('항목이 없습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    analyzeCompetency(items, { prompt: prompt || undefined, mode })
      .then(setResult)
      .catch((e) => setError(e instanceof Error ? e.message : '분석 실패'))
      .finally(() => setLoading(false));
  }, [items, prompt, mode]);

  return (
    <section className={styles.section}>
      <h2>역량 진단 · 점수 · 보완 방향</h2>
      <p className={styles.hint}>
        생기부 내용을 바탕으로 역량을 진단하고, 역량별 점수와 부족 역량 보완 활동을 제안합니다. 대입 전형에 맞는 프롬프트를 입력하면 더 정확합니다.
      </p>
      <div className={styles.controls}>
        <label>
          <span>분석 모드</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as CompetencyMode)}>
            <option value="diagnosis">역량 진단</option>
            <option value="score">역량별 점수</option>
            <option value="supplement">보완 방향</option>
          </select>
        </label>
        <textarea
          className={styles.textarea}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="역량 분석 기준/프롬프트 (선택)"
          rows={2}
        />
        <button type="button" onClick={run} disabled={loading || items.length === 0} className={styles.btn}>
          {loading ? '분석 중…' : '분석 실행'}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {result && (
        <div className={styles.result}>
          {result.summary != null && <p className={styles.summary}>{String(result.summary)}</p>}
          {Array.isArray(result.competencies) && (
            <ul className={styles.list}>
              {(result.competencies as { name?: string; level?: string; evidence?: string }[]).map((c, i) => (
                <li key={i}>
                  <strong>{c.name}</strong> {c.level && `(${c.level})`} — {c.evidence}
                </li>
              ))}
            </ul>
          )}
          {Array.isArray(result.scores) && (
            <ul className={styles.list}>
              {(result.scores as { name?: string; score?: number; brief?: string }[]).map((s, i) => (
                <li key={i}>
                  <strong>{s.name}</strong> {typeof s.score === 'number' && `${s.score}점`} — {s.brief}
                </li>
              ))}
            </ul>
          )}
          {Array.isArray(result.suggestions) && (
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
          )}
          {!result.summary && !(Array.isArray(result.competencies) && result.competencies.length) && !(Array.isArray(result.scores) && result.scores.length) && !(Array.isArray(result.suggestions) && result.suggestions.length) && (
            <pre className={styles.raw}>{JSON.stringify(result, null, 2)}</pre>
          )}
        </div>
      )}
    </section>
  );
}
