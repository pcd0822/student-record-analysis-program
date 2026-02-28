/**
 * 생기부 기록을 활동별로 세분화(내용이 다른 단위 = 문단 단위)한 뒤, 활동 간 연결관계를 분석합니다.
 * 인적·학적사항은 항상 제외합니다.
 * POST body: { items: RecordItem[], prompt?: string }
 * Returns: { nodes: [{ id, label, itemIndex, itemIndices, contentSummary }], links }
 */

const OpenAI = require('openai').default;

const DEFAULT_PROMPT = `다음 "활동"들(같은 영역 내에서도 내용이 다른 활동은 별도 번호) 사이 연결 관계를 **키워드**, **활동 주제**, **활동 내용** 세 가지 기준으로 분석해 주세요.
연관 쌍을 찾을 때: 공통 키워드, 유사 주제, 내용적 연관성을 한 줄로 reason에 적으세요.
응답은 반드시 JSON만: { "pairs": [ { "indexA": 0, "indexB": 1, "reason": "한 줄", "strength": 1~3 } }, ... ] }
indexA, indexB는 활동 번호(0부터). strength는 연결 강도(3=매우 강함, 2=강함, 1=약함).`;

/** 인적·학적사항 여부 (연결관계 분석 시 제외) */
function isPersonalOrAcademic(it) {
  const area = (it.area || '').trim();
  const sub = (it.subCategory || it.label || '').trim();
  const combined = `${area} ${sub}`;
  return /인적|학적/i.test(combined);
}

/** 한 항목의 content를 문단 단위로 쪼갠다. 문단이 여러 개면 활동을 여러 개로 본다. */
function splitContentIntoChunks(content) {
  const raw = (content || '').trim();
  if (!raw) return [];
  const chunks = raw.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  return chunks.length > 0 ? chunks : [raw];
}

/** items에서 인적/학적 제외 후, 문단 단위로 활동을 나눈 목록 반환 */
function buildActivitiesFromItems(items) {
  const activities = [];
  items.forEach((it, itemIdx) => {
    if (isPersonalOrAcademic(it)) return;
    const area = it.area || '기타';
    const sub = it.subCategory || it.label || '기타';
    const chunks = splitContentIntoChunks(it.content);
    chunks.forEach((contentChunk, chunkIdx) => {
      const summary = contentChunk.length > 120 ? contentChunk.slice(0, 120) + '…' : contentChunk;
      activities.push({
        area,
        sub,
        contentChunk: contentChunk.slice(0, 400),
        contentSummary: summary,
        itemIndex: activities.length,
        itemIndices: [itemIdx],
      });
    });
  });
  return activities;
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

  const activities = buildActivitiesFromItems(items);
  if (activities.length === 0) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes: [], links: [], message: '인적·학적사항을 제외한 활동이 없습니다.' }),
    };
  }

  const listText = activities
    .map((a, i) => `[활동 ${i}] ${a.area} - ${a.sub}\n${a.contentChunk}`)
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
      contentSummary: a.contentSummary,
    }));
    const links = pairs
      .filter((p) => typeof p.indexA === 'number' && typeof p.indexB === 'number' && p.indexA >= 0 && p.indexB < activities.length && p.indexA !== p.indexB)
      .map((p) => ({
        source: String(p.indexA),
        target: String(p.indexB),
        reason: p.reason || '',
        strength: typeof p.strength === 'number' ? p.strength : 1,
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
