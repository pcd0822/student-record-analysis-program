import type { RecordItem } from '@/types';

const URL = '/.netlify/functions/competency';

export interface AreaCompetency {
  area: string;
  summary: string;
  academic: number;
  career: number;
  community: number;
}

export interface CompetencyResult {
  summary?: string;
  competencies?: { name?: string; level?: string; evidence?: string }[];
  scores?: { name?: string; score?: number; brief?: string }[];
  suggestions?: { competency?: string; activities?: { area?: string; description?: string }[] }[];
  areaCompetency?: AreaCompetency[];
}

export async function analyzeCompetency(items: RecordItem[]): Promise<CompetencyResult> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
  return data as CompetencyResult;
}
