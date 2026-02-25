import type { RecordItem } from '@/types';

const URL = '/.netlify/functions/competency';

export type CompetencyMode = 'diagnosis' | 'score' | 'supplement';

export async function analyzeCompetency(
  items: RecordItem[],
  options: { prompt?: string; mode?: CompetencyMode } = {}
): Promise<Record<string, unknown>> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, prompt: options.prompt, mode: options.mode || 'diagnosis' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
  return data;
}
