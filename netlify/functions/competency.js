/**
 * 역량 진단 + 역량별 점수·보완 방향.
 * POST body: { items: RecordItem[], prompt?: string, mode: 'diagnosis' | 'score' | 'supplement' }
 */

const OpenAI = require('openai').default;

const DIAGNOSIS_PROMPT = `당신은 대입 전형 자료(생기부)를 기반으로 학생의 역량을 진단하는 전문가입니다.
주어진 생기부 기록을 분석해, 학생이 보여주는 역량(자기주도성, 창의성, 협업, 의사소통, 문제해결, 시민성 등)을 구체적 근거와 함께 서술해 주세요.
응답은 JSON만: { "summary": "한 문단 요약", "competencies": [ { "name": "역량명", "level": "상/중/하", "evidence": "근거 문장" }, ... ] }`;

const SCORE_PROMPT = `위 역량들을 0~100 점수로 수치화해 주세요.
응답은 JSON만: { "scores": [ { "name": "역량명", "score": 0-100, "brief": "한 줄 설명" }, ... ] }`;

const SUPPLEMENT_PROMPT = `점수가 낮은 역량을 보완하기 위한 구체적 활동 방향을 영역별로 제시해 주세요.
응답은 JSON만: { "suggestions": [ { "competency": "역량명", "activities": [ { "area": "영역(창체/교과 등)", "description": "구체적 활동 설명" } ] }, ... ] }`;

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
  const userPrompt = (body.prompt || '').trim();
  const mode = body.mode || 'diagnosis';
  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'items array required' }) };
  }

  const text = items.map((it) => `${it.area || ''} ${it.subCategory || ''}\n${(it.content || '').slice(0, 800)}`).join('\n\n');
  const openai = new OpenAI({ apiKey });

  const defaultPrompt = mode === 'diagnosis' ? DIAGNOSIS_PROMPT : mode === 'score' ? SCORE_PROMPT : SUPPLEMENT_PROMPT;
  const systemPrompt = userPrompt || defaultPrompt;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `생기부 기록:\n\n${text.slice(0, 25000)}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });
    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Competency analysis failed', detail: err?.message }),
    };
  }
};
