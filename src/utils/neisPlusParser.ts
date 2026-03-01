/**
 * 나이스+(neisplus.kr) 생기부 HTML 전용 파서.
 * - .wsBs 클래스에 실제 기록 텍스트가 있음.
 * - 테이블: td 내 div.tbl-inherit[title]으로 학년·영역, 같은 행의 .wsBs가 내용.
 * - view-col: h5.th가 라벨, .td 내 .wsBs가 내용.
 */

import type { RecordItem } from '@/types';

const MIN_CONTENT_LENGTH = 15;

function isNeisPlusFormat(html: string): boolean {
  return (
    html.includes('neisplus') ||
    html.includes('나이스+') ||
    html.includes('class="wsBs"') ||
    html.includes('tbl-inherit')
  );
}

/** title 속성으로 쓰이는 창의적 체험활동 영역 값 (정확히 일치) */
const TITLE_ACTIVITY_AREAS = ['자율활동', '동아리활동', '봉사활동', '진로활동'] as const;

/** 창의적 체험활동 하위 영역 매칭: 공백/표기 변형 포함 */
const CREATIVE_ACTIVITY_PATTERNS: { key: string; patterns: string[] }[] = [
  { key: '자율활동', patterns: ['자율활동', '자율 활동'] },
  { key: '동아리활동', patterns: ['동아리활동', '동아리 활동', '동아리'] },
  { key: '봉사활동', patterns: ['봉사활동', '봉사 활동'] },
  { key: '진로활동', patterns: ['진로활동', '진로 활동'] },
];

function matchCreativeActivityArea(title: string, text: string): string | null {
  const combined = `${title} ${text}`;
  for (const { key, patterns } of CREATIVE_ACTIVITY_PATTERNS) {
    if (patterns.some((p) => combined.includes(p))) return key;
  }
  return null;
}

/** tr 내 모든 셀 텍스트를 합쳐서 창의적 체험 하위 영역 추정 (라벨 셀에 title 없을 때 보완) */
function inferCreativeAreaFromRow(tr: Element): string | null {
  const rowText = tr.textContent?.trim() || '';
  return matchCreativeActivityArea(rowText, rowText);
}

/** 요소나 그 이전 형제 tr에서 title="자율활동" 등 영역 속성 추출 */
function getAreaFromTitleAttribute(tr: Element): string | null {
  const check = (row: Element): string | null => {
    for (const el of row.querySelectorAll('[title]')) {
      const t = (el.getAttribute('title') || '').trim();
      if (TITLE_ACTIVITY_AREAS.includes(t as (typeof TITLE_ACTIVITY_AREAS)[number])) return t;
    }
    return null;
  };
  let current: Element | null = tr;
  while (current && current.tagName === 'TR') {
    const area = check(current);
    if (area) return area;
    current = current.previousElementSibling;
  }
  return null;
}

/** tr에서 학년(숫자), 영역(자율활동 등) 추출 */
function getRowContext(tr: Element): { grade?: number; area?: string; subCategory?: string } {
  const result: { grade?: number; area?: string; subCategory?: string } = {};
  const titleArea = getAreaFromTitleAttribute(tr);
  if (titleArea) result.area = titleArea;

  const withTitle = tr.querySelectorAll('.tbl-inherit[title]');
  withTitle.forEach((el) => {
    const title = (el.getAttribute('title') || '').trim();
    const text = el.textContent?.trim() || '';
    if (/^[123]$/.test(title) || /^[123]$/.test(text)) {
      result.grade = parseInt(title || text, 10);
    } else if (!result.area) {
      const matchedArea = matchCreativeActivityArea(title, text);
      if (matchedArea) {
        result.area = matchedArea;
      } else if (title && !result.subCategory && title.length <= 50) {
        result.subCategory = title;
      }
    }
  });
  if (!result.area) {
    tr.querySelectorAll('.tbl-inherit').forEach((el) => {
      if (result.area) return;
      const t = (el.getAttribute('title') || el.textContent || '').trim();
      if (t && !/^[123]$/.test(t)) {
        const matched = matchCreativeActivityArea(t, t);
        if (matched) result.area = matched;
      }
    });
  }
  if (!result.area) {
    tr.querySelectorAll('td, th').forEach((cell) => {
      if (result.area) return;
      const t = (cell.textContent || '').trim();
      if (t && t.length <= 50 && !/^[123]$/.test(t)) {
        const matched = matchCreativeActivityArea(t, t);
        if (matched) result.area = matched;
      }
    });
  }
  if (!result.area) {
    const inferred = inferCreativeAreaFromRow(tr);
    if (inferred) result.area = inferred;
  }
  return result;
}

/** 교과명 패턴: (1학기)국어:, (2학기)영어: 등 */
const SUBJECT_PREFIX = /(?:\([^)]*\))?\s*([^:\n]{1,20}):\s*/g;

/** 한 셀에 "과목1: ... 과목2: ..." 여러 개일 때 분리 */
function splitBySubjects(content: string): { subject?: string; body: string }[] {
  const matches: { subject: string; matchStart: number; bodyStart: number }[] = [];
  let m: RegExpExecArray | null;
  SUBJECT_PREFIX.lastIndex = 0;
  while ((m = SUBJECT_PREFIX.exec(content)) !== null) {
    const subject = m[1].trim();
    if (subject.length > 0)
      matches.push({ subject, matchStart: m.index, bodyStart: m.index + m[0].length });
  }
  const results: { subject?: string; body: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].matchStart : content.length;
    const body = content.slice(matches[i].bodyStart, bodyEnd).trim();
    if (body.length > 10) results.push({ subject: matches[i].subject, body });
  }
  if (results.length > 0) return results;
  const single = content.match(/^(?:\([^)]*\))?\s*([^:]+):\s*(.*)$/s);
  if (single) {
    const subj = single[1].trim();
    const body = single[2].trim();
    if (subj.length <= 20 && body.length > 10) return [{ subject: subj, body }];
  }
  return [{ body: content }];
}

/** 상위 섹션 제목 찾기 (h2.sub-tit-b) */
function getSectionTitle(el: Element): string | undefined {
  let parent: Element | null = el;
  while (parent) {
    const prev = parent.previousElementSibling;
    if (prev) {
      const h2 = prev.querySelector?.('h2.sub-tit-b') ?? (prev.classList?.contains('tit-wrap') ? prev.querySelector('h2') : null);
      if (h2) return h2.textContent?.trim() || undefined;
      const directH2 = prev.tagName === 'H2' && prev.classList.contains('sub-tit-b') ? prev : null;
      if (directH2) return directH2.textContent?.trim() || undefined;
    }
    const inTitWrap = parent.closest?.('.com-box');
    if (inTitWrap) {
      const t = inTitWrap.querySelector('h2.sub-tit-b');
      if (t) return t.textContent?.trim() || undefined;
    }
    parent = parent.parentElement;
  }
  return undefined;
}

/**
 * 나이스+ HTML에서 기록 항목만 추출
 */
export function parseNeisPlusHtml(html: string): RecordItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const items: RecordItem[] = [];
  const seen = new Set<string>();

  // 1) view-col 형태: .view-col .td .pcView .wsBs 또는 .mobileView .wsBs
  doc.querySelectorAll('.view-col .td .wsBs').forEach((wsBs) => {
    const text = wsBs.textContent?.trim();
    if (!text || text.length < MIN_CONTENT_LENGTH) return;
    const key = text.slice(0, 300);
    if (seen.has(key)) return;
    seen.add(key);
    const viewCol = wsBs.closest('.view-col');
    const label = viewCol?.querySelector('h5.th, .th')?.textContent?.trim() || '학적/기타';
    const section = getSectionTitle(wsBs);
    items.push({
      area: section || inferAreaFromLabel(label),
      subCategory: label,
      label,
      content: text,
      order: items.length + 1,
    });
  });

  // 2) 테이블 내 .wsBs (창의적 체험활동, 교과 세특 등)
  doc.querySelectorAll('table .wsBs').forEach((wsBs) => {
    const text = wsBs.textContent?.trim();
    if (!text || text.length < MIN_CONTENT_LENGTH) return;
    const key = text.slice(0, 300);
    if (seen.has(key)) return;
    seen.add(key); // 동일 셀 내용 재수집 방지

    const tr = wsBs.closest('tr');
    const section = getSectionTitle(wsBs);

    if (tr) {
      const ctx = getRowContext(tr);
      const grade = ctx.grade;
      const area = ctx.area || section || inferAreaFromContent(text);
      const parts = splitBySubjects(text);

      for (const part of parts) {
        const content = part.body || text;
        const subCategory = part.subject || ctx.subCategory;
        const contentKey = content.slice(0, 300);
        if (seen.has(contentKey)) continue;
        seen.add(contentKey);

        items.push({
          area: area || '기타',
          subCategory,
          grade,
          label: subCategory,
          content,
          order: items.length + 1,
        });
      }
    } else {
      items.push({
        area: section || inferAreaFromContent(text),
        content: text,
        order: items.length + 1,
      });
    }
  });

  // 3) title="자율활동", title="동아리활동" 등: 해당 title 뒤(DOM 순서)의 .wsBs를 해당 영역으로 수집 (누락 방지)
  const titleSelectors = TITLE_ACTIVITY_AREAS.map((a) => `[title="${a}"]`).join(', ');
  const allTitleEls = Array.from(doc.querySelectorAll(titleSelectors));
  allTitleEls.forEach((titleEl) => {
    const area = (titleEl.getAttribute('title') || '').trim();
    if (!area) return;
    const root = titleEl.closest('table') || doc.body;
    const nextSectionTitle = allTitleEls.find(
      (other) => other !== titleEl && root.contains(other) && titleEl.compareDocumentPosition(other) === Node.DOCUMENT_POSITION_FOLLOWING
    );
    const allWsBs = Array.from(root.querySelectorAll('.wsBs'));
    const afterTitle = allWsBs.filter((el) => {
      if (titleEl.compareDocumentPosition(el) !== Node.DOCUMENT_POSITION_FOLLOWING) return false;
      if (nextSectionTitle && nextSectionTitle.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_FOLLOWING) return false;
      return true;
    });
    afterTitle.forEach((wsBs) => {
      const text = wsBs.textContent?.trim();
      if (!text || text.length < MIN_CONTENT_LENGTH) return;
      const key = text.slice(0, 300);
      if (seen.has(key)) return;
      seen.add(key);
      const parts = splitBySubjects(text);
      for (const part of parts) {
        const content = part.body || text;
        const contentKey = content.slice(0, 300);
        if (seen.has(contentKey)) continue;
        seen.add(contentKey);
        items.push({
          area,
          label: area,
          content,
          order: items.length + 1,
        });
      }
    });
  });

  return items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function inferAreaFromLabel(label: string): string {
  if (/학적|입학|졸업/.test(label)) return '학적사항';
  if (/특기|수상|자격|출결|수상경력/.test(label)) return '기타';
  return '기타';
}

function inferAreaFromContent(text: string): string {
  if (/자율활동|동아리|봉사|진로활동/.test(text)) return '창의적 체험활동';
  if (/국어:|영어:|수학:|과학:|사회:|역사:/.test(text)) return '교과세특';
  if (/종합의견|교사 의견|인성/.test(text)) return '종합의견';
  return '기타';
}

export { isNeisPlusFormat };
