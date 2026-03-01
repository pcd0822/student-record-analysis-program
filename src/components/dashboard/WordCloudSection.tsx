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

  const run = useCallback(async (isRetry = false) => {
    const text = items.map((i) => i.content).join('\n');
    if (!text.trim()) {
      setError('분석할 내용이 없습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeMorphology(text);
      setWords(result.words);
      setSource(result.source);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '분석 실패';
      if (!isRetry && (msg.includes('504') || msg.includes('502') || msg.includes('요청 실패 (504)') || msg.includes('요청 실패 (502)'))) {
        setError('서버 응답 지연. 잠시 후 자동 재시도합니다…');
        setTimeout(() => run(true), 3000);
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => {
    if (autoRun && items.length > 0 && words.length === 0 && !loading && !error) run();
  }, [autoRun, items.length, run, words.length, loading, error]);

  const maxVal = Math.max(...words.map((w) => w.value), 1);

  return (
    <section className={styles.section}>
      <h2><span aria-hidden>📊</span> 키워드 워드 클라우드</h2>
      <p className={styles.hint}>
        생기부 텍스트를 형태소 분석해 실질형태소만 추출합니다. Netlify에 BAREUN_API_KEY가 있으면 바른AI를 먼저 사용하고, 실패 시 OpenAI로 자동 전환됩니다. 502/504가 나오면 자동으로 한 번 재시도합니다.
      </p>
      {!autoRun && (
        <button type="button" onClick={() => run()} disabled={loading || items.length === 0} className={styles.btn}>
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
