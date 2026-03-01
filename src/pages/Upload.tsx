import { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { parseLifeRecordHtml } from '@/utils/htmlParser';
import { saveRecord } from '@/firebase/records';
import { getAuthInstance } from '@/firebase/config';
import type { RecordItem } from '@/types';
import styles from './Upload.module.css';

type ViewMode = 'byArea' | 'byGrade' | 'raw';

/** 개인정보 수정 모드: 텍스트 분량에 맞춰 높이가 늘어나는 textarea */
function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 52)}px`;
  }, []);
  useEffect(resize, [value, resize]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange(e);
        setTimeout(resize, 0);
      }}
      placeholder={placeholder}
      className={className}
      rows={2}
    />
  );
}

export default function Upload() {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState('');
  const [items, setItems] = useState<RecordItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('byArea');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const html = reader.result as string;
      const parsed = parseLifeRecordHtml(html);
      setItems(parsed.map((it) => ({ ...it, draftContent: undefined })));
      setMessage(null);
      setShowDrafts(false);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }, []);

  function updateItemContent(index: number, content: string) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], content };
      return next;
    });
  }

  function updateItemDraft(index: number, draftContent: string) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], draftContent };
      return next;
    });
  }

  function handleAddActivity() {
    const newItem: RecordItem = {
      area: '기타',
      content: '',
      order: items.length + 1,
    };
    setItems((prev) => [...prev, newItem]);
    setShowDrafts(true);
  }

  async function handleSave() {
    if (!studentId.trim()) {
      setMessage({ type: 'err', text: '학번을 입력해 주세요.' });
      return;
    }
    if (items.length === 0) {
      setMessage({ type: 'err', text: '먼저 생기부 HTML 파일을 업로드해 주세요.' });
      return;
    }
    const user = getAuthInstance().currentUser;
    if (!user) {
      setMessage({ type: 'err', text: '로그인이 필요합니다.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveRecord(studentId.trim(), items, user.uid);
      setMessage({
        type: 'ok',
        text: '저장되었습니다. 조회 탭에서 목록을 새로고침하면 방금 저장한 학번을 볼 수 있고, 해당 학번을 선택한 뒤 "분석 대시보드"로 이동할 수 있습니다.',
      });
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : '저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  }

  const byArea = items.reduce<Record<string, RecordItem[]>>((acc, it) => {
    const key = it.area || '기타';
    if (!acc[key]) acc[key] = [];
    acc[key].push(it);
    return acc;
  }, {});

  const byGrade = items.reduce<Record<string, RecordItem[]>>((acc, it) => {
    const key = it.grade ? `${it.grade}학년` : '학년미지정';
    if (!acc[key]) acc[key] = [];
    acc[key].push(it);
    return acc;
  }, {});

  const getGlobalIndex = (item: RecordItem) => items.findIndex((x) => x === item);

  return (
    <div className={styles.page}>
      <section className={styles.section}>
        <h2>생기부 업로드</h2>
        <p className={styles.hint}>
          HTML 파일 업로드 후 학번을 입력하고 <strong>저장하고 대시보드로</strong>를 누르면 바로 대시보드에서 분석 결과를 볼 수 있습니다. (선택: 개인정보 수정, AI 초안 생성)
        </p>
        <p className={styles.paragraphNotice}>
          <strong>활동 구분 안내:</strong> 한 셀에 서로 다른 활동이 여러 개 있으면, 활동과 활동 사이를 <strong>빈 줄</strong>로 구분해 두세요. 대시보드의 연결관계·역량 분석은 문단(빈 줄) 단위로 활동을 나누어 분석합니다.
        </p>
        <div className={styles.actions}>
          <label className={styles.fileLabel}>
            HTML 파일 선택
            <input type="file" accept=".html,.htm" onChange={handleFile} className={styles.fileInput} />
          </label>
          <div className={styles.idRow}>
            <label>
              학번
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="예: 12345"
                className={styles.idInput}
              />
            </label>
            <button type="button" onClick={handleSave} disabled={saving || items.length === 0}>
              {saving ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              className={styles.dashboardBtn}
              onClick={async () => {
                const sid = studentId.trim();
                const user = getAuthInstance().currentUser;
                if (!sid || !user || items.length === 0) {
                  setMessage({ type: 'err', text: '학번을 입력하고 저장할 항목이 있어야 합니다.' });
                  return;
                }
                setSaving(true);
                setMessage(null);
                try {
                  await saveRecord(sid, items, user.uid);
                  navigate(`/dashboard/${sid}`, { replace: true });
                } catch (e) {
                  setMessage({ type: 'err', text: e instanceof Error ? e.message : '저장에 실패했습니다.' });
                  setSaving(false);
                }
              }}
              disabled={saving || items.length === 0 || !studentId.trim()}
            >
              저장하고 대시보드로
            </button>
          </div>
        </div>
        {items.length > 0 && (
          <div className={styles.analyzeRow}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={editMode}
                onChange={(e) => setEditMode(e.target.checked)}
              />
              개인정보 수정 모드 (내용 셀 직접 편집)
            </label>
            {editMode && (
              <p className={styles.editModeNotice}>
                내용 셀에서 서로 다른 활동은 <strong>빈 줄</strong>로 나누어 입력하세요. (예: 첫 번째 활동 내용 → 빈 줄 → 두 번째 활동 내용) 그러면 대시보드에서 활동별로 구분해 분석합니다.
              </p>
            )}
            {items.some((i) => i.draftContent) && (
              <button
                type="button"
                className={showDrafts ? styles.active : ''}
                onClick={() => setShowDrafts((s) => !s)}
              >
                {showDrafts ? '기록만 보기' : '초안 보기'}
              </button>
            )}
            <button type="button" className={styles.addBtn} onClick={handleAddActivity}>
              활동 추가
            </button>
          </div>
        )}
        {message && (
          <div className={message.type === 'ok' ? styles.msgOk : styles.msgErr}>
            <p>{message.text}</p>
            {message.type === 'ok' && (
              <p className={styles.msgAction}>
                <Link to="/view">조회로 이동</Link>
                {studentId.trim() && (
                  <>
                    {' · '}
                    <Link to={`/dashboard/${studentId.trim()}`}>분석 대시보드 보기</Link>
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </section>

      {items.length > 0 && (
        <section className={styles.section}>
          <div className={styles.tableHeader}>
            <h2>추출된 기록 ({items.length}건)</h2>
            <div className={styles.viewToggle}>
              <button
                type="button"
                className={viewMode === 'byArea' ? styles.active : ''}
                onClick={() => setViewMode('byArea')}
              >
                영역별
              </button>
              <button
                type="button"
                className={viewMode === 'byGrade' ? styles.active : ''}
                onClick={() => setViewMode('byGrade')}
              >
                학년별
              </button>
              <button
                type="button"
                className={viewMode === 'raw' ? styles.active : ''}
                onClick={() => setViewMode('raw')}
              >
                전체
              </button>
            </div>
          </div>

          {viewMode === 'byArea' && (
            <div className={styles.blocks}>
              {Object.entries(byArea).map(([area, list]) => (
                <div key={area} className={styles.block}>
                  <h3>{area}</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>학년</th>
                        <th>구분</th>
                        <th>내용</th>
                        {showDrafts && <th>초안</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((it) => {
                        const idx = getGlobalIndex(it);
                        return (
                          <tr key={idx}>
                            <td>{it.grade ? `${it.grade}학년` : '-'}</td>
                            <td>{it.subCategory || it.label || '-'}</td>
                            <td className={styles.cellContent}>
                              {editMode ? (
                                <AutoResizeTextarea
                                  value={it.content}
                                  onChange={(e) => updateItemContent(idx, e.target.value)}
                                  className={styles.textarea}
                                />
                              ) : (
                                it.content
                              )}
                            </td>
                            {showDrafts && (
                              <td className={styles.cellContent}>
                                {editMode ? (
                                  <AutoResizeTextarea
                                    value={it.draftContent ?? ''}
                                    onChange={(e) => updateItemDraft(idx, e.target.value)}
                                    placeholder="분석하기 후 초안이 표시됩니다"
                                    className={styles.textarea}
                                  />
                                ) : (
                                  it.draftContent ?? '-'
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'byGrade' && (
            <div className={styles.blocks}>
              {Object.entries(byGrade).map(([grade, list]) => (
                <div key={grade} className={styles.block}>
                  <h3>{grade}</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>영역</th>
                        <th>구분</th>
                        <th>내용</th>
                        {showDrafts && <th>초안</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((it) => {
                        const idx = getGlobalIndex(it);
                        return (
                          <tr key={idx}>
                            <td>{it.area}</td>
                            <td>{it.subCategory || it.label || '-'}</td>
                            <td className={styles.cellContent}>
                              {editMode ? (
                                <AutoResizeTextarea
                                  value={it.content}
                                  onChange={(e) => updateItemContent(idx, e.target.value)}
                                  className={styles.textarea}
                                />
                              ) : (
                                it.content
                              )}
                            </td>
                            {showDrafts && (
                              <td className={styles.cellContent}>
                                {editMode ? (
                                  <AutoResizeTextarea
                                    value={it.draftContent ?? ''}
                                    onChange={(e) => updateItemDraft(idx, e.target.value)}
                                    placeholder="분석하기 후 초안 표시"
                                    className={styles.textarea}
                                  />
                                ) : (
                                  it.draftContent ?? '-'
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'raw' && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>순서</th>
                  <th>영역</th>
                  <th>학년</th>
                  <th>구분</th>
                  <th>내용</th>
                  {showDrafts && <th>초안</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.order ?? i + 1}</td>
                    <td>{it.area}</td>
                    <td>{it.grade ? `${it.grade}학년` : '-'}</td>
                    <td>{it.subCategory || it.label || '-'}</td>
                    <td className={styles.cellContent}>
                      {editMode ? (
                        <AutoResizeTextarea
                          value={it.content}
                          onChange={(e) => updateItemContent(i, e.target.value)}
                          className={styles.textarea}
                        />
                      ) : (
                        it.content
                      )}
                    </td>
                    {showDrafts && (
                      <td className={styles.cellContent}>
                        {editMode ? (
                          <AutoResizeTextarea
                            value={it.draftContent ?? ''}
                            onChange={(e) => updateItemDraft(i, e.target.value)}
                            placeholder="초안"
                            className={styles.textarea}
                          />
                        ) : (
                          it.draftContent ?? '-'
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
