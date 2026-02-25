const OpenAI = require('openai').default;

const SYSTEM_PROMPT = `당신은 고등학교 생활기록부(생기부)를 대입에 유리하게 정리·보완하는 전문가입니다.
주어진 생기부 항목들을 청크(유지할 단위)로 구분하고, 각 청크에 대해 다음을 수행합니다:
1. 기존 내용을 대입에 유리한 서술로 다듬은 초안 문장을 한 문단 이내로 작성합니다.
2. 추상적 표현보다 구체적 행동·성과·역량이 드러나도록 합니다.
3. 개인정보(실명·학교명·지역 등)는 포함하지 않습니다.
4. 원문의 의미와 사실은 유지하면서 표현만 개선합니다.

응답은 반드시 아래 형태의 JSON 객체 하나만 출력합니다. 다른 텍스트는 포함하지 마세요.
{ "drafts": [ { "order": 1, "draftContent": "초안 문장" }, { "order": 2, "draftContent": "..." }, ... ] }
- order: 원본 항목 순서(1부터 시작하는 정수). 주어진 항목 수만큼 모두 작성합니다.
- draftContent: 해당 항목에 대한 초안 문장(한 문단 이내).`;

/**
 * Netlify serverless function: POST body { items: RecordItem[] }
 * Returns { itemsWithDrafts: (RecordItem & { draftContent: string })[] }
 * OPENAI_API_KEY is set in Netlify env.
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'items array is required and must not be empty' }),
    };
  }

  const openai = new OpenAI({ apiKey });

  const userContent = items
    .map(
      (it, i) =>
        `[${i + 1}] 영역: ${it.area || '-'} | 학년: ${it.grade || '-'} | 구분: ${it.subCategory || it.label || '-'}\n내용: ${(it.content || '').slice(0, 2000)}`
    )
    .join('\n\n');

  const userPrompt = `다음 생기부 항목들에 대해 위 지시에 따라 초안을 작성해 주세요. JSON 배열만 출력하고 다른 설명은 하지 마세요.\n\n${userContent}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Empty response from OpenAI' }),
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OpenAI response was not valid JSON', raw: text.slice(0, 500) }),
      };
    }

    let drafts = [];
    if (Array.isArray(parsed)) {
      drafts = parsed;
    } else if (parsed && typeof parsed === 'object') {
      drafts = parsed.drafts || parsed.itemsWithDrafts || parsed.items || parsed.results || [];
    }
    if (!Array.isArray(drafts)) drafts = [];

    const byOrder = {};
    drafts.forEach((d) => {
      const order = Number(d.order);
      if (order >= 1 && order <= items.length) byOrder[order] = d.draftContent || '';
    });

    const itemsWithDrafts = items.map((it, i) => ({
      ...it,
      draftContent: byOrder[i + 1] ?? '',
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemsWithDrafts }),
    };
  } catch (err) {
    const message = err?.message || String(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Analysis failed', detail: message }),
    };
  }
};
