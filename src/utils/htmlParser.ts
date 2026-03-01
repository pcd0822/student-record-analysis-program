/**
 * 생기부 HTML에서 기록이 있는 항목들을 영역/학년별로 추출합니다.
 * 학교/포맷에 따라 다를 수 있으므로, 테이블·리스트·div 텍스트를 수집해
 * 키워드로 영역을 구분하는 방식을 사용합니다.
 */

import type { RecordItem } from '@/types';

const AREA_KEYWORDS: Record<string, string[]> = {
  '창의적 체험활동': ['창의적 체험활동', '창체', '창의적체험활동'],
  '자율활동': ['자율활동', '자율 활동'],
  '동아리활동': ['동아리활동', '동아리 활동'],
  '봉사활동': ['봉사활동', '봉사 활동'],
  '진로활동': ['진로활동', '진로 활동'],
  '교과성적': ['교과 성적', '교과성적', '학업성적', '성적'],
  '교과세특': ['교과 세부능력특기사항', '세특', '세부능력'],
  '교과독서': ['독서', '독서활동'],
  '행동특성': ['행동의 특성', '행동특성'],
  '종합의견': ['종합의견', '교사 의견'],
};

const GRADE_PATTERNS = [
  { pattern: /1학년|1학년도|고1/g, grade: 1 },
  { pattern: /2학년|2학년도|고2/g, grade: 2 },
  { pattern: /3학년|3학년도|고3/g, grade: 3 },
];

function inferArea(text: string, context: string): string {
  const combined = `${context} ${text}`.toLowerCase();
  for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
    if (keywords.some((k) => combined.includes(k.toLowerCase()))) return area;
  }
  return '기타';
}

function inferGrade(text: string, context: string): number | undefined {
  const combined = `${context} ${text}`;
  for (const { pattern, grade } of GRADE_PATTERNS) {
    if (pattern.test(combined)) return grade;
  }
  return undefined;
}

/** HTML 문자열에서 텍스트가 있는 노드들을 수집 (테이블 셀, div, p, li 등). title="자율활동" 등도 컨텍스트로 사용 */
function extractTextNodes(html: string): { text: string; context: string }[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const results: { text: string; context: string }[] = [];
  const walk = (node: Node, parentLabels: string[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text && text.length > 2) results.push({ text, context: parentLabels.join(' ') });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const labels = [...parentLabels];
    const titleVal = el.getAttribute?.('title');
    const titleArea = titleVal != null ? getAreaFromTitleAttr(titleVal) : null;
    if (titleArea) labels.push(titleArea);
    if (['th', 'td', 'caption', 'h1', 'h2', 'h3', 'h4', 'strong', 'b'].includes(tag)) {
      const t = el.textContent?.trim();
      if (t) labels.push(t);
    }
    for (const child of el.childNodes) walk(child, labels);
  };
  walk(doc.body, []);
  return results;
}

/** 셀 텍스트가 창의적 체험 하위(자율/동아리/봉사/진로)인지 확인 후 영역 반환 */
const ACTIVITY_TYPE_PATTERNS = [
  { key: '자율활동', patterns: ['자율활동', '자율 활동'] },
  { key: '동아리활동', patterns: ['동아리활동', '동아리 활동', '동아리'] },
  { key: '봉사활동', patterns: ['봉사활동', '봉사 활동'] },
  { key: '진로활동', patterns: ['진로활동', '진로 활동'] },
];
function getActivityTypeFromCell(cellText: string): string | null {
  const t = (cellText || '').trim();
  if (!t || t.length > 50) return null;
  for (const { key, patterns } of ACTIVITY_TYPE_PATTERNS) {
    if (patterns.some((p) => t.includes(p))) return key;
  }
  return null;
}

const TITLE_ACTIVITY_VALUES = ['자율활동', '동아리활동', '봉사활동', '진로활동'] as const;
const TITLE_TO_AREA: Record<string, string> = {
  '자율활동': '자율활동', '자율 활동': '자율활동',
  '동아리활동': '동아리활동', '동아리 활동': '동아리활동',
  '봉사활동': '봉사활동', '봉사 활동': '봉사활동',
  '진로활동': '진로활동', '진로 활동': '진로활동',
};

function getAreaFromTitleAttr(val: string): string | null {
  const t = val.trim();
  if (TITLE_ACTIVITY_VALUES.includes(t as (typeof TITLE_ACTIVITY_VALUES)[number])) return t;
  return TITLE_TO_AREA[t] ?? null;
}

/** tr 또는 이전 형제 tr에서 title="자율활동" 등 영역 속성 추출 (공백 변형 지원) */
function getContextFromTitleAttr(tr: Element): string | null {
  const check = (row: Element): string | null => {
    for (const el of row.querySelectorAll('[title]')) {
      const area = getAreaFromTitleAttr(el.getAttribute('title') || '');
      if (area) return area;
    }
    return null;
  };
  let cur: Element | null = tr;
  while (cur && cur.tagName === 'TR') {
    const v = check(cur);
    if (v) return v;
    cur = cur.previousElementSibling;
  }
  return null;
}

/** 테이블 기반 추출: th+td 쌍 또는 td만 있는 행에서 내용 수집. title 속성·행 텍스트로 자율/동아리 등 보정 */
function extractFromTables(doc: Document): { text: string; context: string }[] {
  const results: { text: string; context: string }[] = [];
  const tables = doc.querySelectorAll('table');
  tables.forEach((table) => {
    const rows = table.querySelectorAll('tr');
    let currentContext = '';
    rows.forEach((tr) => {
      const titleContext = getContextFromTitleAttr(tr);
      if (titleContext) currentContext = titleContext;

      const cells = tr.querySelectorAll('th, td');
      let rowContext = titleContext || currentContext;
      const contentCells: string[] = [];
      cells.forEach((cell) => {
        const el = cell as Element;
        const titleVal = el.getAttribute?.('title');
        const titleArea = titleVal != null ? getAreaFromTitleAttr(titleVal) : null;
        if (titleArea) rowContext = titleArea;
        const t = cell.textContent?.trim() || '';
        const asActivity = getActivityTypeFromCell(t);
        const isTh = cell.tagName.toLowerCase() === 'th';
        const isTd = cell.tagName.toLowerCase() === 'td';
        if (asActivity) {
          rowContext = asActivity;
        } else if (isTh && t) {
          rowContext = t;
        }
        if (t && isTh) {
          currentContext = t;
        }
        if (t && isTd) {
          if (!asActivity || t.length > 40) contentCells.push(t);
        }
      });
      if (rowContext) currentContext = rowContext;
      contentCells.forEach((text) => {
        if (text.length > 1 && !/^\s*[-·]\s*$/.test(text)) {
          results.push({ text, context: rowContext || currentContext });
        }
      });
    });
  });
  return results;
}

import { isNeisPlusFormat, parseNeisPlusHtml } from './neisPlusParser';

/**
 * 생기부 HTML 전체에서 기록 항목 배열로 파싱.
 * 나이스+ 형식이면 전용 파서를 사용하고, 아니면 일반 테이블/텍스트 파서를 사용합니다.
 */
export function parseLifeRecordHtml(html: string): RecordItem[] {
  if (isNeisPlusFormat(html)) {
    return parseNeisPlusHtml(html);
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const fromTables = extractFromTables(doc);
  const fromWalk = extractTextNodes(html);
  const combined = fromTables.length ? fromTables : fromWalk;
  const seen = new Set<string>();
  const items: RecordItem[] = combined
    .filter(({ text }) => {
      const key = text.slice(0, 200);
      if (seen.has(key)) return false;
      seen.add(key);
      return text.length >= 2 && !/^\s*[-·]\s*$/.test(text);
    })
    .map(({ text, context }, i) => ({
      area: inferArea(text, context),
      subCategory: context.slice(0, 100) || undefined,
      grade: inferGrade(text, context),
      label: context || undefined,
      content: text,
      order: i + 1,
    }));
  return items;
}
