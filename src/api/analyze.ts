import type { RecordItem } from '@/types';
import type { AnalyzeResponse } from '@/types';

const ANALYZE_URL = '/.netlify/functions/analyze';

/** 한 번에 처리할 항목 수. Netlify 함수 타임아웃(10~26초) 내에 완료되도록 제한 */
const BATCH_SIZE = 5;

type ItemWithDraft = RecordItem & { draftContent: string };

function ensureDrafts(records: RecordItem[]): ItemWithDraft[] {
  return records.map((r) => ({ ...r, draftContent: r.draftContent ?? '' }));
}

async function analyzeBatch(items: RecordItem[]): Promise<ItemWithDraft[]> {
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
  return ensureDrafts(data.itemsWithDrafts as RecordItem[]);
}

/**
 * 생기부 항목별 AI 초안 생성. 항목이 많을 경우 배치로 나눠 요청해 504 타임아웃을 피합니다.
 */
export async function analyzeItems(items: RecordItem[]): Promise<AnalyzeResponse> {
  if (items.length === 0) {
    return { itemsWithDrafts: [] };
  }
  if (items.length <= BATCH_SIZE) {
    const itemsWithDrafts = await analyzeBatch(items);
    return { itemsWithDrafts };
  }
  const itemsWithDrafts: ItemWithDraft[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const chunkResult = await analyzeBatch(chunk);
    itemsWithDrafts.push(...chunkResult);
  }
  return { itemsWithDrafts };
}
