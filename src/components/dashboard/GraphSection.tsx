import { useState, useCallback, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { getGraphConnections, type GraphNode } from '@/api/graph';
import type { RecordItem } from '@/types';
import styles from './GraphSection.module.css';

interface Props {
  items: RecordItem[];
  autoRun?: boolean;
}

interface GraphData {
  nodes: GraphNode[];
  links: { source: string; target: string; reason: string; strength?: number }[];
}

function parseLabel(label: string): { area: string; sub: string } {
  const i = label.indexOf(' · ');
  if (i >= 0) return { area: label.slice(0, i), sub: label.slice(i + 3) };
  return { area: label, sub: '' };
}

export default function GraphSection({ items, autoRun = true }: Props) {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [manualLinks, setManualLinks] = useState<{ source: string; target: string }[]>([]);
  const [dragNode, setDragNode] = useState<number | null>(null);

  const run = useCallback(() => {
    if (items.length === 0) {
      setError('항목이 없습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    getGraphConnections(items)
      .then(({ nodes, links }) => {
        setGraph({ nodes, links });
        setSelectedNode(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '분석 실패'))
      .finally(() => setLoading(false));
  }, [items]);

  useEffect(() => {
    if (autoRun && items.length > 0 && !graph && !loading && !error) run();
  }, [autoRun, items.length, run, graph, loading, error]);

  const selectedNodeData = graph && selectedNode != null ? graph.nodes.find((n) => n.id === String(selectedNode)) : null;
  const selectedItemIndices = selectedNodeData?.itemIndices ?? (selectedNode != null ? [selectedNode] : []);
  const allLinks = graph
    ? [
        ...graph.links,
        ...manualLinks.map((m) => ({ source: m.source, target: m.target, reason: '직접 연결', strength: 1 })),
      ]
    : [];
  const connectedActivityIndices = new Set<number>();
  if (graph && selectedNode != null) {
    allLinks.forEach((l) => {
      if (l.source === String(selectedNode) || l.target === String(selectedNode)) {
        connectedActivityIndices.add(Number(l.source));
        connectedActivityIndices.add(Number(l.target));
      }
    });
  }
  const linkCountByNode = new Map<string, number>();
  allLinks.forEach((l) => {
    const s = String(l.source);
    const t = String(l.target);
    linkCountByNode.set(s, (linkCountByNode.get(s) ?? 0) + 1);
    linkCountByNode.set(t, (linkCountByNode.get(t) ?? 0) + 1);
  });
  const maxLinks = Math.max(...linkCountByNode.values(), 1);

  const handleRowDragStart = (e: React.DragEvent, nodeIndex: number) => {
    setDragNode(nodeIndex);
    e.dataTransfer.setData('text/plain', String(nodeIndex));
    e.dataTransfer.effectAllowed = 'link';
  };
  const handleRowDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = dragNode ?? (e.dataTransfer.getData('text/plain') ? parseInt(e.dataTransfer.getData('text/plain'), 10) : null);
    setDragNode(null);
    if (sourceIndex == null || sourceIndex === targetIndex || !graph) return;
    const sourceId = graph.nodes[sourceIndex]?.id;
    const targetId = graph.nodes[targetIndex]?.id;
    if (!sourceId || !targetId) return;
    setManualLinks((prev) => [...prev, { source: sourceId, target: targetId }]);
  };
  const handleRowDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleRowDragEnd = () => setDragNode(null);

  return (
    <section className={styles.section}>
      <h2><span className={styles.icon} aria-hidden>🔗</span> 활동 연결관계</h2>
      <p className={styles.hint}>
        키워드·활동 주제·활동 내용 기준으로 연결 관계를 분석합니다. 연결이 많은 노드는 굵게 표시됩니다.
      </p>
      {loading && <p className={styles.loading}>연결관계 분석 중…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {graph && graph.nodes.length > 0 && (
        <>
        <div className={styles.graphLayout}>
          <div className={styles.activityTableWrap}>
            <h3>활동별 기록 (내용 요약)</h3>
            <p className={styles.dragHint}>연결 추가: 행을 드래그해 다른 행 위에 놓으면 연결이 추가됩니다.</p>
            <table className={styles.activityTable}>
              <thead>
                <tr>
                  <th>영역</th>
                  <th>구분</th>
                  <th>내용 요약</th>
                </tr>
              </thead>
              <tbody>
                {graph.nodes.map((node, i) => {
                  const { area, sub } = parseLabel(node.label);
                  return (
                    <tr
                      key={node.id}
                      className={`${selectedNode === i ? styles.selectedRow : ''} ${dragNode === i ? styles.dragging : ''}`}
                      onClick={() => setSelectedNode(i)}
                      draggable
                      onDragStart={(e) => handleRowDragStart(e, i)}
                      onDrop={(e) => handleRowDrop(e, i)}
                      onDragOver={handleRowDragOver}
                      onDragEnd={handleRowDragEnd}
                    >
                      <td>{area}</td>
                      <td>{sub}</td>
                      <td className={styles.cellSummary}>{node.contentSummary ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.graphWrap}>
            <ForceGraph2D
              graphData={{ nodes: graph.nodes, links: allLinks }}
              width={360}
              height={320}
              nodeLabel={(n) => (n as GraphNode).label}
              onNodeClick={(n) => setSelectedNode((n as GraphNode).itemIndex)}
              linkLabel={(l) => (l as { reason?: string }).reason || ''}
              nodeVal={(node) => {
                const id = (node as { id?: string }).id ?? '';
                const links = linkCountByNode.get(id) ?? 0;
                return 3 + (links / maxLinks) * 7;
              }}
              nodeColor={(node) => {
                const id = (node as { id?: string }).id ?? '';
                if (selectedNode === Number(id)) return '#f59e0b';
                const links = linkCountByNode.get(id) ?? 0;
                return links >= 2 ? '#8b7cb8' : '#b8a9e0';
              }}
            />
          </div>
        </div>
        {manualLinks.length > 0 && (
          <p className={styles.manualLinksNote}>
            직접 추가한 연결 {manualLinks.length}개 · <button type="button" className={styles.clearManualBtn} onClick={() => setManualLinks([])}>초기화</button>
          </p>
        )}
        </>
      )}
      {selectedNodeData !== null && selectedNodeData !== undefined && (
        <div className={styles.detail}>
          <h4>선택한 활동</h4>
          <p className={styles.itemMeta}>{selectedNodeData.label}</p>
          <p className={styles.itemContent}>{selectedNodeData.contentSummary ?? ''}</p>
          <ul className={styles.connectedList}>
            {selectedItemIndices.map((i: number) => {
              const it = items[i];
              if (!it) return null;
              return (
                <li key={i}>
                  <strong>[원본 {i + 1}]</strong> {it.grade ? `${it.grade}학년 ` : ''}
                  {(it.content || '').slice(0, 120)}{(it.content || '').length > 120 ? '…' : ''}
                </li>
              );
            })}
          </ul>
          {connectedActivityIndices.size > 1 && (
            <>
              <h4>연결된 활동</h4>
              <ul className={styles.connectedList}>
                {Array.from(connectedActivityIndices)
                  .filter((i: number) => i !== selectedNode)
                  .map((i: number) => {
                    const node = graph?.nodes.find((n) => n.id === String(i));
                    return node ? <li key={i}><strong>{node.label}</strong></li> : null;
                  })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
