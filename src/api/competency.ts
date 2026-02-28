import type { RecordItem } from '@/types';

const URL = '/.netlify/functions/competency';

export interface AreaCompetency {
  area: string;
  summary: string;
  academic: number;
  career: number;
  community: number;
}

export interface ActivityCompetency extends AreaCompetency {
  sub?: string;
}

export interface CompetencyResult {
  summary?: string;
  competencies?: { name?: string; level?: string; evidence?: string }[];
  scores?: { name?: string; score?: number; brief?: string }[];
  suggestions?: { competency?: string; activities?: { area?: string; description?: string }[] }[];
  areaCompetency?: AreaCompetency[];
  /** 활동별 역량 (영역 내 내용이 다른 활동 단위). 있으면 이걸 우선 표시 */
  activityCompetency?: ActivityCompetency[];
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
