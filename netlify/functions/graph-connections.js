/**
 * 생기부 기록을 활동별로 세분화한 뒤, 활동 간 연결관계를 분석합니다.
 * POST body: { items: RecordItem[], prompt?: string }
 * Returns: { nodes: [{ id, label, itemIndex, itemIndices }], links: [{ source, target, reason }] }
 * - nodes: 활동 단위 (영역+구분으로 그룹), itemIndices = 해당 활동에 속한 원본 항목 인덱스 배열
 */

const OpenAI = require('openai').default;

const DEFAULT_PROMPT = `다음 "활동"들(생기부에서 영역·구분별로 묶은 단위) 사이에 연관성이 있는 쌍을 찾아 주세요.
예: 같은 역량이 드러남, 같은 주제가 이어짐, 인성·태도가 일관됨 등.
응답은 반드시 JSON만 출력: { "pairs": [ { "indexA": 0, "indexB": 1, "reason": "한 줄 설명" }, ... ] }
indexA, indexB는 0부터 시작하는 활동 번호입니다.`;

function groupByActivity(items) {
  const map = new Map();
  items.forEach((it, idx) => {
    const area = it.area || '기타';
    const sub = it.subCategory || it.label || '기타';
    const key = `${area}|${sub}`;
    if (!map.has(key)) {
      map.set(key, { key, area, sub, itemIndices: [], contents: [] });
    }
    const group = map.get(key);
    group.itemIndices.push(idx);
    group.contents.push((it.content || '').slice(0, 400));
  });
  return Array.from(map.values());
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'OPENAI_API_KEY not set' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const items = body.items;
  const userPrompt = body.prompt || '';
  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'items array required' }) };
  }

  const activities = groupByActivity(items);
  const listText = activities
    .map((a, i) => `[활동 ${i}] ${a.area} - ${a.sub}\n${a.contents.join('\n')}`)
    .join('\n\n');

  const systemPrompt = userPrompt.trim() || DEFAULT_PROMPT;
  const userContent = `다음 활동들에 대해 위 지시대로 연결 쌍을 분석해 주세요. JSON만 출력.\n\n${listText}`;

  const openai = new OpenAI({ apiKey });
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const text = completion.choices[0]?.message?.content?.trim() || '{}';
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { pairs: [] };
    }
    const pairs = Array.isArray(data.pairs) ? data.pairs : [];
    const nodes = activities.map((a, i) => ({
      id: String(i),
      label: `${a.area} · ${a.sub}`,
      itemIndex: i,
      itemIndices: a.itemIndices,
    }));
    const links = pairs
      .filter((p) => typeof p.indexA === 'number' && typeof p.indexB === 'number' && p.indexA >= 0 && p.indexB < activities.length && p.indexA !== p.indexB)
      .map((p) => ({
        source: String(p.indexA),
        target: String(p.indexB),
        reason: p.reason || '',
      }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes, links }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Analysis failed', detail: err?.message }),
    };
  }
};
