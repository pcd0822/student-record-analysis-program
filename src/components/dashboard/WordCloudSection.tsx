import { useState, useCallback } from 'react';
import { analyzeMorphology, type WordItem } from '@/api/morphology';
import type { RecordItem } from '@/types';
import styles from './WordCloudSection.module.css';

interface Props {
  items: RecordItem[];
}

export default function WordCloudSection({ items }: Props) {
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

  const maxVal = Math.max(...words.map((w) => w.value), 1);

  return (
    <section className={styles.section}>
      <h2>키워드 워드 클라우드</h2>
      <p className={styles.hint}>
        생기부 텍스트를 형태소 분석해 실질형태소(명사·동사·형용사 등)만 추출합니다. 바른AI API 키가 있으면 사용하고, 없으면 OpenAI로 추출합니다.
      </p>
      <button type="button" onClick={run} disabled={loading || items.length === 0} className={styles.btn}>
        {loading ? '분석 중…' : '워드 클라우드 생성'}
      </button>
      {error && <p className={styles.error}>{error}</p>}
      {source && <p className={styles.meta}>분석: {source === 'bareun' ? '바른AI' : 'OpenAI'}</p>}
      {words.length > 0 && (
        <div className={styles.cloud}>
          {words.slice(0, 100).map((w) => (
            <span
              key={w.word}
              className={styles.word}
              style={{
                fontSize: `${12 + Math.round((w.value / maxVal) * 24)}px`,
              }}
              title={`${w.word}: ${w.value}`}
            >
              {w.word}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
