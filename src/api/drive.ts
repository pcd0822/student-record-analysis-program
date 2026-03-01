const URL = '/.netlify/functions/fetch-drive-folder';

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
}

export interface FetchDriveFolderResult {
  content: string;
  fileCount: number;
  totalChars: number;
  files?: DriveFileInfo[];
}

/**
 * Google Drive 폴더 링크 또는 폴더 ID로 폴더 내 문서 텍스트를 가져옵니다.
 * (폴더는 서비스 계정 이메일과 공유되어 있어야 함)
 */
export async function fetchDriveFolder(folderUrlOrId: string): Promise<FetchDriveFolderResult> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderUrl: folderUrlOrId.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.detail || `폴더 불러오기 실패 (${res.status})`);
  }
  return data as FetchDriveFolderResult;
}

/** 입력이 Google Drive 폴더 링크 또는 폴더 ID 형태인지 판별 */
export function isDriveFolderInput(input: string): boolean {
  const trimmed = (input || '').trim();
  if (!trimmed) return false;
  if (/drive\.google\.com\/drive\/folders\//.test(trimmed)) return true;
  if (/drive\.google\.com\/open\?id=/.test(trimmed)) return true;
  if (/^[a-zA-Z0-9_-]{20,50}$/.test(trimmed)) return true;
  return false;
}
