/**
 * 역량 진단 + 점수 + 보완 방향 + 영역별 역량 퍼센트를 한 번에 반환.
 * 고정 프롬프트(학종 3역량) 사용. POST body: { items: RecordItem[] }
 */

const OpenAI = require('openai').default;

const SYSTEM_PROMPT = `당신은 학생부 종합 전형(학종) 역량 평가 전문가입니다. 아래 기준에 따라 생기부 기록을 분석합니다.

【평가 맥락】
학생부 종합 전형(학종)은 기존 4개 요소(학업역량, 전공적합성, 발전가능성, 인성)에서 변화하여, 최근 대부분의 대학에서 학업역량, 진로역량, 공동체역량의 3가지 핵심 역량을 중심으로 정성 평가합니다. 3년간의 교과 성적, 선택 과목, 세부능력 및 특기사항(세특), 비교과 활동을 통해 자기주도적 학습 능력, 전공 관련 노력, 공동체 의식을 종합적으로 평가합니다.

• 학업역량 (가장 중요): 대학에서 학업을 수행할 수 있는 능력으로, 교과 성취도(내신 등급), 학업 태도, 탐구 활동 등을 평가합니다. 성적의 우상향 추이나 과목 선택의 도전성도 중요하게 봅니다.
• 진로역량: 희망 전공(계열)에 대한 관심과 노력, 진로 탐색 경험을 평가합니다. 관련 교과목 이수 및 성취도, 전공 관련 교과 세특, 창의적 체험활동 등이 핵심입니다.
• 공동체역량: 공동체의 목표 달성을 위해 협력하고 기여하는 능력으로, 봉사정신, 책임감, 나눔과 배려, 소통 능력 등을 평가합니다.

【응답 형식】 반드시 아래 JSON 하나만 출력하세요. 다른 텍스트는 포함하지 마세요.
{
  "summary": "전체 생기부 역량을 한 문단으로 요약",
  "competencies": [ { "name": "역량명", "level": "상/중/하", "evidence": "근거" }, ... ],
  "scores": [ { "name": "학업역량", "score": 0-100, "brief": "한 줄" }, { "name": "진로역량", "score": 0-100, "brief": "한 줄" }, { "name": "공동체역량", "score": 0-100, "brief": "한 줄" } ],
  "suggestions": [ { "competency": "역량명", "activities": [ { "area": "영역", "description": "활동 설명" } ] }, ... ],
  "areaCompetency": [ { "area": "영역명(예: 창의적 체험활동)", "summary": "해당 영역 기록 내용 요약(2~3문장)", "academic": 0-100, "career": 0-100, "community": 0-100 }, ... ]
}
- areaCompetency: 주어진 생기부의 각 영역(area)별로 한 개씩 넣고, 해당 영역 활동이 학업역량·진로역량·공동체역량과 얼마나 관련 있는지 0~100 퍼센트로 제시하세요.`;

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
  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'items array required' }) };
  }

  const text = items.map((it) => `${it.area || ''} ${it.subCategory || ''}\n${(it.content || '').slice(0, 800)}`).join('\n\n');
  const userContent = `다음 생기부 기록을 위 지시에 따라 분석해 주세요. 영역(area)은 반드시 기록에 등장한 영역명 그대로 사용하고, areaCompetency에는 모든 영역을 빠짐없이 포함하세요.\n\n${text.slice(0, 28000)}`;

  const openai = new OpenAI({ apiKey });
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
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
    if (!Array.isArray(data.areaCompetency)) data.areaCompetency = [];
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
