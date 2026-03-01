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
  const connectedActivityIndices = new Set<number>();
  if (graph && selectedNode != null) {
    graph.links.forEach((l) => {
      if (l.source === String(selectedNode) || l.target === String(selectedNode)) {
        connectedActivityIndices.add(Number(l.source));
        connectedActivityIndices.add(Number(l.target));
      }
    });
  }

  const linkCountByNode = new Map<string, number>();
  graph?.links.forEach((l) => {
    const s = String(l.source);
    const t = String(l.target);
    linkCountByNode.set(s, (linkCountByNode.get(s) ?? 0) + 1);
    linkCountByNode.set(t, (linkCountByNode.get(t) ?? 0) + 1);
  });
  const maxLinks = Math.max(...linkCountByNode.values(), 1);

  return (
    <section className={styles.section}>
      <h2><span className={styles.icon} aria-hidden>🔗</span> 활동 연결관계</h2>
      <p className={styles.hint}>
        키워드·활동 주제·활동 내용 기준으로 연결 관계를 분석합니다. 연결이 많은 노드는 굵게 표시됩니다.
      </p>
      {loading && <p className={styles.loading}>연결관계 분석 중…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {graph && graph.nodes.length > 0 && (
        <div className={styles.graphLayout}>
          <div className={styles.activityTableWrap}>
            <h3>활동별 기록 (내용 요약)</h3>
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
                      className={selectedNode === i ? styles.selectedRow : ''}
                      onClick={() => setSelectedNode(i)}
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
              graphData={graph}
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
