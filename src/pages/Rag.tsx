import { useState, useCallback } from 'react';
import { fetchDriveFolder } from '@/api/drive';
import type { DriveFileInfo } from '@/api/drive';
import styles from './Rag.module.css';

const DRIVE_FILE_URL = '/.netlify/functions/drive-file';

export default function Rag() {
  const [folderLink, setFolderLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFileInfo[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    const link = folderLink.trim();
    if (!link) {
      setError('폴더 링크를 입력해 주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    setFiles([]);
    setSelectedFileId(null);
    try {
      const result = await fetchDriveFolder(link);
      setFiles(result.files || []);
      if (!result.files?.length && result.fileCount === 0) {
        setError('폴더에 참고할 문서가 없거나, 폴더를 서비스 계정과 공유해 주세요.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '폴더 불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [folderLink]);

  const pdfFiles = files.filter((f) => f.mimeType === 'application/pdf');

  return (
    <div className={styles.page}>
      <section className={styles.section}>
        <h2>RAG · 참고 자료 폴더</h2>
        <p className={styles.hint}>
          Google Drive 폴더 링크를 연결하면 해당 폴더의 문서(PDF) 목록을 보고, PDF를 바로 볼 수 있습니다. (폴더를 서비스 계정 이메일과 공유해야 합니다.)
        </p>
        <div className={styles.connectRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="https://drive.google.com/drive/folders/xxxx"
            value={folderLink}
            onChange={(e) => setFolderLink(e.target.value)}
          />
          <button
            type="button"
            className={styles.connectBtn}
            onClick={handleConnect}
            disabled={loading}
          >
            {loading ? '연결 중…' : '연결'}
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </section>

      {files.length > 0 && (
        <section className={styles.section}>
          <h3>폴더 내 문서 ({files.length}개)</h3>
          <div className={styles.layout}>
            <ul className={styles.fileList}>
              {pdfFiles.length > 0 ? (
                pdfFiles.map((f) => (
                  <li
                    key={f.id}
                    className={selectedFileId === f.id ? styles.fileItemActive : styles.fileItem}
                    onClick={() => setSelectedFileId(f.id)}
                  >
                    <span className={styles.fileIcon}>📄</span>
                    {f.name}
                  </li>
                ))
              ) : (
                files.map((f) => (
                  <li
                    key={f.id}
                    className={selectedFileId === f.id ? styles.fileItemActive : styles.fileItem}
                    onClick={() => setSelectedFileId(f.id)}
                  >
                    <span className={styles.fileIcon}>📄</span>
                    {f.name}
                  </li>
                ))
              )}
            </ul>
            <div className={styles.viewerWrap}>
              {selectedFileId ? (
                <iframe
                  title="PDF 뷰어"
                  className={styles.pdfViewer}
                  src={`${DRIVE_FILE_URL}?fileId=${encodeURIComponent(selectedFileId)}`}
                />
              ) : (
                <p className={styles.viewerPlaceholder}>왼쪽에서 문서를 선택하세요.</p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
