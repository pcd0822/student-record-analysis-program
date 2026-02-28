import type { RecordItem } from '@/types';

const URL = '/.netlify/functions/graph-connections';

export interface GraphNode {
  id: string;
  label: string;
  itemIndex: number;
  /** 해당 활동에 속한 원본 항목 인덱스 */
  itemIndices?: number[];
  /** 활동 내용 요약 (건수 대신 표시) */
  contentSummary?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  reason: string;
  strength?: number;
}

export async function getGraphConnections(
  items: RecordItem[],
  prompt?: string
): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, prompt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
  return { nodes: data.nodes || [], links: data.links || [] };
}
