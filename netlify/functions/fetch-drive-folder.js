/**
 * Google Drive 폴더 링크 또는 폴더 ID를 받아, 폴더 내 문서들의 텍스트를 합쳐 반환.
 * env: GOOGLE_SERVICE_ACCOUNT_JSON (서비스 계정 JSON 문자열)
 * 사용 전 해당 폴더를 서비스 계정 이메일에 "뷰어"로 공유해야 함.
 */

const { google } = require('googleapis');
const pdfParse = require('pdf-parse');

const MAX_TOTAL_CHARS = 120000;
const DRIVE_FOLDER_URL_PATTERN = /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/;
const DRIVE_OPEN_ID_PATTERN = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;

function extractFolderId(input) {
  const trimmed = (input || '').trim();
  const m1 = trimmed.match(DRIVE_FOLDER_URL_PATTERN);
  if (m1) return m1[1];
  const m2 = trimmed.match(DRIVE_OPEN_ID_PATTERN);
  if (m2) return m2[1];
  if (/^[a-zA-Z0-9_-]{20,50}$/.test(trimmed)) return trimmed;
  return null;
}

function getAuthClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || typeof raw !== 'string') {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');
  }
  let key;
  try {
    key = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON');
  }
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return auth;
}

async function listFilesInFolder(drive, folderId) {
  const files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100,
      pageToken: pageToken || undefined,
    });
    const list = res.data.files || [];
    files.push(...list);
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);
  return files;
}

async function getFileText(drive, fileId, mimeType) {
  if (mimeType === 'application/vnd.google-apps.document') {
    const res = await drive.files.export({
      fileId,
      mimeType: 'text/plain',
    });
    return (res.data && typeof res.data === 'string') ? res.data : '';
  }
  if (mimeType === 'text/plain' || mimeType === 'text/csv' || mimeType === 'text/markdown') {
    const res = await drive.files.get({
      fileId,
      alt: 'media',
    }, { responseType: 'text' });
    return (res.data && typeof res.data === 'string') ? res.data : String(res.data || '');
  }
  if (mimeType === 'application/pdf') {
    const res = await drive.files.get({
      fileId,
      alt: 'media',
    }, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(res.data || []);
    if (buffer.length === 0) return '';
    const data = await pdfParse(buffer);
    return (data && data.text) ? data.text : '';
  }
  return '';
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

  const folderUrl = body.folderUrl || body.folderId || '';
  const folderId = extractFolderId(folderUrl);
  if (!folderId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: '유효한 Google Drive 폴더 링크 또는 폴더 ID가 필요합니다. 예: https://drive.google.com/drive/folders/xxxx',
      }),
    };
  }

  try {
    const auth = getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    const files = await listFilesInFolder(drive, folderId);
    const textParts = [];
    let totalChars = 0;
    const exportable = [
      'application/vnd.google-apps.document',
      'text/plain',
      'text/csv',
      'text/markdown',
      'application/pdf',
    ];

    for (const file of files) {
      if (totalChars >= MAX_TOTAL_CHARS) break;
      const mime = (file.mimeType || '').trim();
      if (!exportable.includes(mime)) continue;
      try {
        const text = await getFileText(drive, file.id, mime);
        if (text && text.trim()) {
          const chunk = `[${file.name || '제목 없음'}]\n${text.trim()}\n\n`;
          const len = chunk.length;
          if (totalChars + len > MAX_TOTAL_CHARS) {
            textParts.push(chunk.slice(0, MAX_TOTAL_CHARS - totalChars));
            totalChars = MAX_TOTAL_CHARS;
            break;
          }
          textParts.push(chunk);
          totalChars += len;
        }
      } catch (err) {
        console.warn('Skip file', file.id, file.name, err?.message);
      }
    }

    const content = textParts.join('');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        fileCount: textParts.length,
        totalChars: content.length,
      }),
    };
  } catch (err) {
    const msg = err?.message || 'Unknown error';
    if (msg.includes('GOOGLE_SERVICE_ACCOUNT_JSON')) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Google Drive 연동이 설정되지 않았습니다. GOOGLE_SERVICE_ACCOUNT_JSON 환경 변수를 확인하세요.',
        }),
      };
    }
    if (msg.includes('404') || msg.includes('not found')) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: '폴더를 찾을 수 없거나, 해당 폴더가 서비스 계정 이메일과 공유되지 않았습니다. 폴더를 서비스 계정 이메일에 "뷰어"로 공유해 주세요.',
        }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Drive 폴더 불러오기 실패', detail: msg }),
    };
  }
};
