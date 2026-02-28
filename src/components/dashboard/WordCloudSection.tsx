import { useState, useCallback, useEffect } from 'react';
import { analyzeMorphology, type WordItem } from '@/api/morphology';
import type { RecordItem } from '@/types';
import styles from './WordCloudSection.module.css';

interface Props {
  items: RecordItem[];
  autoRun?: boolean;
}

const WORD_COLORS = ['#1e3a5f', '#2563eb', '#0ea5e9', '#06b6d4', '#0891b2', '#0d9488', '#059669', '#10b981', '#14b8a6', '#2dd4bf'];

export default function WordCloudSection({ items, autoRun = true }: Props) {
  const [words, setWords] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const text = items.map((i) => i.content).join('\n');
    if (!text.trim()) {
      setError('분석할 내용이 없습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    analyzeMorphology(text)
      .then(({ words: w, source: s }) => {
        setWords(w);
        setSource(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '분석 실패'))
      .finally(() => setLoading(false));
  }, [items]);

  useEffect(() => {
    if (autoRun && items.length > 0 && words.length === 0 && !loading && !error) run();
  }, [autoRun, items.length, run, words.length, loading, error]);

  const maxVal = Math.max(...words.map((w) => w.value), 1);

  return (
    <section className={styles.section}>
      <h2>키워드 워드 클라우드</h2>
      <p className={styles.hint}>
        생기부 텍스트를 형태소 분석해 실질형태소만 추출합니다. Netlify에 BAREUN_API_KEY가 있으면 바른AI를 먼저 사용하고, 실패 시 OpenAI로 자동 전환됩니다. 504가 나오면 잠시 후 다시 시도해 보세요.
      </p>
      {!autoRun && (
        <button type="button" onClick={run} disabled={loading || items.length === 0} className={styles.btn}>
          {loading ? '분석 중…' : '워드 클라우드 생성'}
        </button>
      )}
      {loading && <p className={styles.loading}>워드 클라우드 분석 중…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {source && <p className={styles.meta}>분석: {source === 'bareun' ? '바른AI' : 'OpenAI'}</p>}
      {words.length > 0 && (
        <div className={styles.cloud}>
          {words.slice(0, 120).map((w, idx) => {
            const size = 11 + Math.round((w.value / maxVal) * 28);
            const color = WORD_COLORS[idx % WORD_COLORS.length];
            return (
              <span
                key={`${w.word}-${idx}`}
                className={styles.word}
                style={{ fontSize: `${size}px`, color }}
                title={`${w.word}: ${w.value}`}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}
