/**
 * 생기부 항목 간 연결관계 분석 (연결망 형성 프롬프트 사용).
 * POST body: { items: RecordItem[], prompt?: string }
 * Returns: { nodes: [{ id, label, itemIndex }], links: [{ source, target, reason }] }
 */

const OpenAI = require('openai').default;

const DEFAULT_PROMPT = `다음 생기부 기록들 사이에 "연관성이 있는 쌍"을 찾아 주세요.
예: 같은 역량이 드러남, 같은 활동/주제가 이어짐, 인성·태도가 일관됨 등.
응답은 반드시 JSON만 출력: { "pairs": [ { "indexA": 0, "indexB": 1, "reason": "한 줄 설명" }, ... ] }
indexA, indexB는 0부터 시작하는 항목 번호입니다.`;

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

  const listText = items
    .map((it, i) => `[${i}] ${it.area || ''} ${it.subCategory || ''}\n${(it.content || '').slice(0, 500)}`)
    .join('\n\n');

  const systemPrompt = userPrompt.trim() || DEFAULT_PROMPT;
  const userContent = `다음 생기부 항목들에 대해 위 지시대로 연결 쌍을 분석해 주세요. JSON만 출력.\n\n${listText}`;

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
    const nodes = items.map((it, i) => ({
      id: String(i),
      label: `${it.area || '기타'} ${(it.subCategory || it.content || '').slice(0, 20)}`,
      itemIndex: i,
    }));
    const links = pairs
      .filter((p) => typeof p.indexA === 'number' && typeof p.indexB === 'number' && p.indexA >= 0 && p.indexB < items.length && p.indexA !== p.indexB)
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
