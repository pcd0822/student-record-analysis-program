import type { RecordItem } from '@/types';

const URL = '/.netlify/functions/competency';

export interface AreaCompetency {
  area: string;
  summary: string;
  academic: number;
  career: number;
  community: number;
  sub?: string;
  grade?: number;
  /** 특징적인 부분에 대한 피드백 */
  feedback?: string;
}

export interface ActivityCompetency extends AreaCompetency {
  sub?: string;
  grade?: number;
  feedback?: string;
}

export interface CompetencyResult {
  summary?: string;
  competencies?: { name?: string; level?: string; evidence?: string }[];
  scores?: { name?: string; score?: number; brief?: string }[];
  /** 영역별 구체적 탐구활동 (보완 방향) */
  suggestions?: { area?: string; activities?: { description?: string }[] }[];
  areaCompetency?: AreaCompetency[];
  activityCompetency?: ActivityCompetency[];
}

export async function analyzeCompetency(
  items: RecordItem[],
  options?: { referenceMaterials?: string }
): Promise<CompetencyResult> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, referenceMaterials: options?.referenceMaterials }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
  return data as CompetencyResult;
}
