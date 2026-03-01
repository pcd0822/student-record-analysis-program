/**
 * 역량 진단 + 점수 + 보완 방향 + 활동별 역량 퍼센트 반환.
 * 인적·학적사항 제외, 같은 영역 내에서도 내용이 다른 활동(문단 단위)을 구분해 활동별로 분석.
 * POST body: { items: RecordItem[] }
 */

const OpenAI = require('openai').default;

const SYSTEM_PROMPT = `당신은 학생부 종합 전형(학종) 역량 평가 전문가입니다. 아래 기준에 따라 생기부 기록을 분석합니다.

【평가 맥락】
학생부 종합 전형(학종)은 학업역량, 진로역량, 공동체역량의 3가지 핵심 역량을 중심으로 정성 평가합니다.
• 학업역량: 대학에서 학업을 수행할 수 있는 능력(교과 성취도, 학업 태도, 탐구 활동 등).
• 진로역량: 희망 전공에 대한 관심과 노력, 진로 탐색 경험.
• 공동체역량: 협력, 봉사정신, 책임감, 나눔과 배려, 소통 능력 등.

【응답 형식】 반드시 아래 JSON 하나만 출력하세요.
{
  "summary": "전체 생기부 역량을 한 문단으로 요약",
  "competencies": [ { "name": "역량명", "level": "상/중/하", "evidence": "근거" }, ... ],
  "scores": [ { "name": "학업역량", "score": 0-100, "brief": "한 줄" }, { "name": "진로역량", "score": 0-100, "brief": "한 줄" }, { "name": "공동체역량", "score": 0-100, "brief": "한 줄" } ],
  "suggestions": [ { "area": "영역명", "activities": [ { "description": "해당 영역에서 보완할 수 있는 구체적인 탐구활동 1~2문장" } ] }, ... ],
  "activityCompetency": [ { "area": "영역명", "sub": "세부 영역", "grade": 1~3(학년, 없으면 null), "summary": "해당 활동 내용 1~2문장 요약", "academic": 0-100, "career": 0-100, "community": 0-100, "feedback": "특징적인 부분에 대한 피드백 1~2문장" }, ... ]
}
- activityCompetency: 아래 "활동 목록"에 나온 순서대로, 각 활동마다 정확히 한 개씩 넣으세요. grade는 원본 활동의 학년(1~3). feedback에는 해당 활동의 특징·강점·주의점 등 구체적 피드백을 작성하세요.
- suggestions: 역량별이 아니라 영역별로 구체적인 탐구활동을 제시하세요. area는 영역명(창의적 체험활동, 교과세특 등), activities에는 그 영역에서 보완할 수 있는 구체적인 탐구활동을 2~3개 넣으세요.`;

function isPersonalOrAcademic(it) {
  const area = (it.area || '').trim();
  const sub = (it.subCategory || it.label || '').trim();
  return /인적|학적/i.test(`${area} ${sub}`);
}

function splitContentIntoChunks(content) {
  const raw = (content || '').trim();
  if (!raw) return [];
  const chunks = raw.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  return chunks.length > 0 ? chunks : [raw];
}

function buildActivitiesFromItems(items) {
  const activities = [];
  items.forEach((it) => {
    if (isPersonalOrAcademic(it)) return;
    const area = it.area || '기타';
    const sub = it.subCategory || it.label || '기타';
    const grade = it.grade;
    const chunks = splitContentIntoChunks(it.content);
    chunks.forEach((contentChunk) => {
      activities.push({ area, sub, grade, contentChunk: contentChunk.slice(0, 600) });
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
  const referenceMaterials = body.referenceMaterials || '';
  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'items array required' }) };
  }

  const activities = buildActivitiesFromItems(items);
  const overallText = items
    .filter((it) => !isPersonalOrAcademic(it))
    .map((it) => `${it.area || ''} ${it.subCategory || ''}\n${(it.content || '').slice(0, 800)}`)
    .join('\n\n');
  const activityListText = activities
    .map((a, i) => `[활동 ${i}] 학년:${a.grade ?? '-'} ${a.area} - ${a.sub}\n${a.contentChunk}`)
    .join('\n\n');
  const refBlock = referenceMaterials.trim()
    ? `\n\n【참고 자료 - 반드시 참고하여 역량 점수를 측정하세요】\n${referenceMaterials.slice(0, 6000)}`
    : '';
  const userContent = `다음 생기부 기록(인적·학적사항 제외)을 위 지시에 따라 분석해 주세요.${refBlock}

【전체 기록 요약용】
${overallText.slice(0, 12000)}

【활동 목록】(같은 영역 내에서도 내용이 다른 활동은 문단 단위로 나뉨. activityCompetency는 이 순서대로 각 활동당 한 개씩 넣으세요.)
${activityListText.slice(0, 16000)}`;

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
    if (!Array.isArray(data.activityCompetency)) data.activityCompetency = [];
    data.activityCompetency.forEach((ac, i) => {
      if (activities[i] && ac.grade == null) ac.grade = activities[i].grade;
    });
    data.areaCompetency = data.activityCompetency;
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
