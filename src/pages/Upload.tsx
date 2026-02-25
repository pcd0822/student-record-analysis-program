import { useState, useCallback } from 'react';
import { parseLifeRecordHtml } from '@/utils/htmlParser';
import { saveRecord } from '@/firebase/records';
import { getAuthInstance } from '@/firebase/config';
import { analyzeItems } from '@/api/analyze';
import type { RecordItem } from '@/types';
import styles from './Upload.module.css';

type ViewMode = 'byArea' | 'byGrade' | 'raw';

export default function Upload() {
  const [studentId, setStudentId] = useState('');
  const [items, setItems] = useState<RecordItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('byArea');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
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

  async function handleAnalyze() {
    if (items.length === 0) {
      setMessage({ type: 'err', text: '먼저 생기부를 업로드해 주세요.' });
      return;
    }
    setAnalyzing(true);
    setMessage(null);
    try {
      const { itemsWithDrafts } = await analyzeItems(items);
      setItems(itemsWithDrafts);
      setShowDrafts(true);
      setMessage({ type: 'ok', text: '초안 생성이 완료되었습니다. 초안을 수정하거나 활동을 추가한 뒤 저장하세요.' });
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : '분석에 실패했습니다.' });
    } finally {
      setAnalyzing(false);
    }
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
      setMessage({ type: 'ok', text: '저장되었습니다.' });
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
          HTML 파일 업로드 → 개인정보 삭제·수정 → 분석하기(초안 생성) → 활동 추가/수정 후 저장. (이름은 저장하지 않습니다)
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
            <button
              type="button"
              className={styles.analyzeBtn}
              onClick={handleAnalyze}
              disabled={analyzing || items.length === 0}
            >
              {analyzing ? '분석 중…' : '분석하기 (AI 초안 생성)'}
            </button>
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
          <p className={message.type === 'ok' ? styles.msgOk : styles.msgErr}>{message.text}</p>
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
                                <textarea
                                  value={it.content}
                                  onChange={(e) => updateItemContent(idx, e.target.value)}
                                  rows={2}
                                  className={styles.textarea}
                                />
                              ) : (
                                it.content
                              )}
                            </td>
                            {showDrafts && (
                              <td className={styles.cellContent}>
                                {editMode ? (
                                  <textarea
                                    value={it.draftContent ?? ''}
                                    onChange={(e) => updateItemDraft(idx, e.target.value)}
                                    placeholder="분석하기 후 초안이 표시됩니다"
                                    rows={2}
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
                                <textarea
                                  value={it.content}
                                  onChange={(e) => updateItemContent(idx, e.target.value)}
                                  rows={2}
                                  className={styles.textarea}
                                />
                              ) : (
                                it.content
                              )}
                            </td>
                            {showDrafts && (
                              <td className={styles.cellContent}>
                                {editMode ? (
                                  <textarea
                                    value={it.draftContent ?? ''}
                                    onChange={(e) => updateItemDraft(idx, e.target.value)}
                                    placeholder="분석하기 후 초안 표시"
                                    rows={2}
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
                        <textarea
                          value={it.content}
                          onChange={(e) => updateItemContent(i, e.target.value)}
                          rows={2}
                          className={styles.textarea}
                        />
                      ) : (
                        it.content
                      )}
                    </td>
                    {showDrafts && (
                      <td className={styles.cellContent}>
                        {editMode ? (
                          <textarea
                            value={it.draftContent ?? ''}
                            onChange={(e) => updateItemDraft(i, e.target.value)}
                            placeholder="초안"
                            rows={2}
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
