/**
 * Google Drive에서 단일 파일을 가져와 그대로 반환 (PDF 뷰어 등).
 * GET ?fileId=xxx
 * env: GOOGLE_SERVICE_ACCOUNT_JSON
 */

const { google } = require('googleapis');

function getAuthClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || typeof raw !== 'string') throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');
  let key;
  try {
    key = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON invalid JSON');
  }
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const fileId = event.queryStringParameters?.fileId || '';
  if (!fileId) {
    return { statusCode: 400, body: 'fileId required' };
  }

  try {
    const auth = getAuthClient();
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    const buffer = Buffer.from(res.data || []);
    const contentType = res.headers['content-type'] || 'application/pdf';
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('404') || msg.includes('not found')) {
      return { statusCode: 404, body: 'File not found' };
    }
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Failed to fetch file',
    };
  }
};
