import type { RecordItem } from '@/types';

const URL = '/.netlify/functions/graph-connections';

export interface GraphNode {
  id: string;
  label: string;
  itemIndex: number;
  /** 해당 활동에 속한 원본 항목 인덱스 (활동별 그래프용) */
  itemIndices?: number[];
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
