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

/** tr에서 학년(숫자), 영역(자율활동 등) 추출 */
function getRowContext(tr: Element): { grade?: number; area?: string; subCategory?: string } {
  const result: { grade?: number; area?: string; subCategory?: string } = {};
  const inherits = tr.querySelectorAll('.tbl-inherit[title]');
  inherits.forEach((el) => {
    const title = (el.getAttribute('title') || '').trim();
    const text = el.textContent?.trim() || '';
    if (/^[123]$/.test(title) || /^[123]$/.test(text)) {
      result.grade = parseInt(title || text, 10);
    } else if (
      ['자율활동', '동아리활동', '봉사활동', '진로활동'].some((a) => title.includes(a) || text.includes(a))
    ) {
      result.area = title || text;
    } else if (title && !result.subCategory && title.length <= 50) {
      result.subCategory = title;
    }
  });
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
