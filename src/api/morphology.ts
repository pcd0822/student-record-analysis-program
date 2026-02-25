const URL = '/.netlify/functions/morphology';

export interface WordItem {
  word: string;
  value: number;
}

export async function analyzeMorphology(text: string): Promise<{ words: WordItem[]; source: string }> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
  return { words: data.words || [], source: data.source || 'unknown' };
}
