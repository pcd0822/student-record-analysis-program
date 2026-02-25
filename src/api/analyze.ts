import type { RecordItem } from '@/types';
import type { AnalyzeResponse } from '@/types';

const ANALYZE_URL = '/.netlify/functions/analyze';

export async function analyzeItems(items: RecordItem[]): Promise<AnalyzeResponse> {
  const res = await fetch(ANALYZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.detail || `분석 실패 (${res.status})`);
  }
  if (!data.itemsWithDrafts || !Array.isArray(data.itemsWithDrafts)) {
    throw new Error('분석 결과 형식이 올바르지 않습니다.');
  }
  return data as AnalyzeResponse;
}
