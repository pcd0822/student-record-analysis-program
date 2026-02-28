/**
 * 생기부 텍스트 형태소 분석 (바른AI 또는 OpenAI 폴백).
 * 실질형태소만 추출해 빈도 반환 → 워드 클라우드용.
 *
 * env: BAREUN_API_KEY (바른 클라우드), 또는 미설정 시 OPENAI_API_KEY로 키워드 추출
 */

const BAREUN_URL = 'https://api.bareun.ai/bareun.LanguageService/AnalyzeSyntax';

/** 문법형태소 제외, 실질형태소만 (명사, 동사, 형용사, 부사 등) */
const CONTENT_POS = new Set([
  'NNG', 'NNP', 'NNB', 'NR', 'NP', 'VV', 'VA', 'MAG', 'SL', 'SH', 'SN',
  'NF', 'NV', 'XPN', 'XR', 'MM', 'IC', 'XSN', 'XSV', 'XSA', 'XSM', 'XSO', 'XPV'
]);

function extractFromBareunResponse(body) {
  const counts = {};
  try {
    const sentences = body?.sentences || body?.result?.sentences || [];
    for (const sent of sentences) {
      const tokens = sent?.tokens || [];
      for (const token of tokens) {
        const morphemes = token?.morphemes || [];
        for (const m of morphemes) {
          const tag = (m.tag || m.pos || '').toUpperCase();
          const content = (m.text?.content || m.content || '').trim();
          if (!content || content.length < 2) continue;
          if (!CONTENT_POS.has(tag)) continue;
          if (/^[0-9]+$/.test(content)) continue;
          counts[content] = (counts[content] || 0) + 1;
        }
      }
    }
  } catch (_) {}
  return counts;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const text = (body.text || body.content || '').trim().slice(0, 50000);
  if (!text) {
    return { statusCode: 400, body: JSON.stringify({ error: 'text or content required' }) };
  }

  const bareunKey = process.env.BAREUN_API_KEY;
  if (bareunKey) {
    try {
      const res = await fetch(BAREUN_URL, {
        method: 'POST',
        headers: {
          'api-key': bareunKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document: { content: text, language: 'ko-KR' },
          encoding_type: 'UTF8',
          auto_split_sentence: true,
          auto_spacing: true,
          auto_jointing: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const counts = extractFromBareunResponse(data);
        const words = Object.entries(counts)
          .map(([word, count]) => ({ word, value: count }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 150);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ words, source: 'bareun' }),
        };
      }
      // Bareun 실패 시 아래 OpenAI 폴백으로 진행 (에러 반환하지 않음)
    } catch (_) {
      // Bareun 요청 실패 시 OpenAI 폴백으로 진행
    }
  }

  // 폴백: OpenAI로 키워드 추출 (실질어만 나열)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return {
      statusCode: 503,
      body: JSON.stringify({ error: 'BAREUN_API_KEY or OPENAI_API_KEY required' }),
    };
  }

  const OpenAI = require('openai').default;
  const openai = new OpenAI({ apiKey: openaiKey });
  const prompt = `다음 텍스트에서 조사·어미를 제외한 실질형태소(명사, 동사, 형용사, 부사 등)만 추출해 빈도순으로 나열해 주세요.
각 단어는 한 줄에 "단어:빈도" 형식으로 출력하고, 다른 설명은 하지 마세요. 최대 150개까지.
텍스트:\n${text.slice(0, 12000)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    const raw = completion.choices[0]?.message?.content?.trim() || '';
    const words = [];
    const seen = new Set();
    for (const line of raw.split('\n')) {
      const m = line.match(/^[\s\S]*?([가-힣a-zA-Z0-9_]+)\s*:\s*(\d+)\s*$/);
      if (m) {
        const w = m[1].trim();
        if (w.length >= 2 && !seen.has(w)) {
          seen.add(w);
          words.push({ word: w, value: parseInt(m[2], 10) });
        }
      }
    }
    words.sort((a, b) => b.value - a.value);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: words.slice(0, 150), source: 'openai' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Keyword extraction failed', detail: err?.message }),
    };
  }
};
