import { useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { getGraphConnections, type GraphNode } from '@/api/graph';
import type { RecordItem } from '@/types';
import styles from './GraphSection.module.css';

interface Props {
  items: RecordItem[];
}

interface GraphData {
  nodes: { id: string; label: string; itemIndex: number }[];
  links: { source: string; target: string; reason: string }[];
}

export default function GraphSection({ items }: Props) {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [prompt, setPrompt] = useState('');
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
    getGraphConnections(items, prompt || undefined)
      .then(({ nodes, links }) => {
        setGraph({ nodes, links });
        setSelectedNode(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '분석 실패'))
      .finally(() => setLoading(false));
  }, [items, prompt]);

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

  return (
    <section className={styles.section}>
      <h2>활동 연결관계 그래프</h2>
      <p className={styles.hint}>
        생기부 항목 간 연관성을 분석해 옵시디언 스타일 그래프로 표시합니다. 연결 기준은 아래 프롬프트로 조정할 수 있습니다.
      </p>
      <textarea
        className={styles.textarea}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="연결망 형성 기준을 설명하는 프롬프트 (선택)"
        rows={2}
      />
      <button type="button" onClick={run} disabled={loading || items.length === 0} className={styles.btn}>
        {loading ? '분석 중…' : '연결관계 분석'}
      </button>
      {error && <p className={styles.error}>{error}</p>}
      {graph && graph.nodes.length > 0 && (
        <div className={styles.graphWrap}>
          <ForceGraph2D
            graphData={graph}
            width={600}
            height={400}
            nodeLabel={(n) => (n as GraphNode).label}
            onNodeClick={(n) => setSelectedNode((n as GraphNode).itemIndex)}
            linkLabel={(l) => (l as { reason?: string }).reason || ''}
          />
        </div>
      )}
      {selectedNodeData !== null && selectedNodeData !== undefined && (
        <div className={styles.detail}>
          <h3>선택한 활동</h3>
          <p className={styles.itemMeta}>{selectedNodeData.label}</p>
          <h4>해당 활동 기록 ({selectedItemIndices.length}건)</h4>
          <ul className={styles.connectedList}>
            {selectedItemIndices.map((i) => {
              const it = items[i];
              if (!it) return null;
              return (
                <li key={i}>
                  <strong>[{i + 1}]</strong> {it.grade ? `${it.grade}학년 ` : ''}
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
                  .filter((i) => i !== selectedNode)
                  .map((i) => {
                    const node = graph?.nodes.find((n) => n.id === String(i));
                    return node ? (
                      <li key={i}>
                        <strong>{node.label}</strong>
                      </li>
                    ) : null;
                  })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
