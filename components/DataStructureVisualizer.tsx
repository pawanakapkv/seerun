import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet } from 'react-native';

// ── Constants ─────────────────────────────────────────────────────────────────
const R = 34;        // node radius
const H_GAP = 32;    // horizontal gap between nodes
const V_GAP = 90;    // vertical gap between levels
const PAD = 50;      // canvas padding

interface Props { vars: Record<string, any>; heap?: Record<string, any>; theme: any; }
interface Pos { x: number; y: number; }
interface EdgeInfo { from: string; to: string; label: string; isCycle: boolean; }
interface NodeLayout { addr: string; pos: Pos; varLabels: string[]; }

// ── helpers ───────────────────────────────────────────────────────────────────
const isPtr = (v: any) =>
  v && ((v._type === 'pointer' && v.data && v.data !== '0x0') ||
    (v._type === 'raw' && typeof v.data === 'string' && v.data.startsWith('0x') && v.data.length > 4));

const getFields = (node: any): Record<string, any> =>
  (node && (node.fields || (typeof node.data === 'object' ? node.data : null))) || {};

const primaryValue = (node: any): string => {
  if (!node) return '?';
  const prims = Object.entries(getFields(node)).filter(([, v]: any) => v?._type === 'primitive');
  if (!prims.length) return node.name || '?';
  if (prims.length === 1) return String((prims[0][1] as any).data);
  return prims.map(([k, v]: any) => `${k}:${v.data}`).join('\n');
};

// ── layout algorithm ──────────────────────────────────────────────────────────
function buildLayout(
  roots: string[],
  heap: Record<string, any>,
  localPtrs: Record<string, string[]>
): { nodes: NodeLayout[]; edges: EdgeInfo[]; w: number; h: number } {
  const depth: Record<string, number> = {};
  const slot:  Record<string, number> = {};
  const depthCount: Record<number, number> = {};
  const visited = new Set<string>();
  const edges: EdgeInfo[] = [];
  const queue = [...roots];
  roots.forEach(a => { depth[a] = 0; });

  while (queue.length) {
    const addr = queue.shift()!;
    if (visited.has(addr)) continue;
    visited.add(addr);
    const d = depth[addr] ?? 0;
    const s = depthCount[d] ?? 0;
    slot[addr] = s;
    depthCount[d] = s + 1;
    const node = heap[addr];
    if (!node) continue;
    Object.entries(getFields(node)).forEach(([name, val]: any) => {
      if (!isPtr(val)) return;
      const tgt = val.data;
      const isCycle = visited.has(tgt);
      edges.push({ from: addr, to: tgt, label: name, isCycle });
      if (!isCycle && depth[tgt] === undefined) {
        depth[tgt] = d + 1;
        queue.push(tgt);
      }
    });
  }

  // Detect chain vs tree
  const maxOut = Math.max(0, ...Object.keys(depth).map(a =>
    edges.filter(e => e.from === a && !e.isCycle).length));
  const isChain = maxOut <= 1;

  const positions: Record<string, Pos> = {};
  if (isChain) {
    // Horizontal layout
    let col = 0;
    const bfsOrder = [...roots];
    const seen = new Set<string>();
    while (bfsOrder.length) {
      const a = bfsOrder.shift()!;
      if (seen.has(a)) continue;
      seen.add(a);
      positions[a] = { x: PAD + col * (R * 2 + H_GAP) + R, y: PAD + R };
      col++;
      const node = heap[a];
      if (node) {
        Object.values(getFields(node)).forEach((v: any) => {
          if (isPtr(v) && !seen.has(v.data)) bfsOrder.push(v.data);
        });
      }
    }
  } else {
    // Tree layout
    Object.keys(depth).forEach(addr => {
      const d = depth[addr];
      const s = slot[addr];
      const cnt = depthCount[d] ?? 1;
      const totalW = cnt * (R * 2 + H_GAP) - H_GAP;
      positions[addr] = {
        x: PAD + s * (R * 2 + H_GAP) + R - totalW / 2 + totalW / 2,
        y: PAD + d * (R * 2 + V_GAP) + R,
      };
    });
  }

  // Nodes not in heap (placeholder)
  roots.forEach(a => { if (!positions[a]) positions[a] = { x: PAD + R, y: PAD + R }; });

  const allPos = Object.values(positions);
  const maxX = Math.max(...allPos.map(p => p.x)) + R + PAD;
  const maxY = Math.max(...allPos.map(p => p.y)) + R + PAD;

  const nodes: NodeLayout[] = Object.keys(positions).map(addr => ({
    addr,
    pos: positions[addr],
    varLabels: localPtrs[addr] || [],
  }));

  return { nodes, edges, w: maxX, h: maxY };
}

// ── Edge component ───────────────────────────────────────────────
function Edge({ from, to, label, isCycle, shift = { ox: 0, oy: 0 }, theme }: {
  from: Pos; to: Pos; label: string; isCycle: boolean;
  shift?: { ox: number; oy: number }; theme: any;
}) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return null;
  const ux = dx / dist, uy = dy / dist;
  const { ox, oy } = shift;

  // Start/end at circle edge (+5px clearance so arrowhead sits outside node)
  const CLEAR = R + 5;
  const sx = from.x + ux * CLEAR + ox;
  const sy = from.y + uy * CLEAR + oy;
  const ex = to.x   - ux * CLEAR + ox;
  const ey = to.y   - uy * CLEAR + oy;

  const lineLen = Math.max(0, dist - CLEAR * 2);
  const cx = (sx + ex) / 2, cy = (sy + ey) / 2;
  const angle = Math.atan2(ey - sy, ex - sx) * 180 / Math.PI;
  const color = isCycle ? theme.accent : theme.textMuted;

  return (
    <>
      {/* Line — behind nodes */}
      <View style={{
        position: 'absolute', left: cx - lineLen / 2, top: cy - 1,
        width: lineLen, height: 2, backgroundColor: color,
        opacity: isCycle ? 0.5 : 0.8,
        transform: [{ rotate: `${angle}deg` }],
        zIndex: 1,
      }} />
      {/* Arrowhead — on top of everything */}
      <View style={{
        position: 'absolute', left: ex - 5, top: ey - 5,
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: color, opacity: 0.95,
        zIndex: 10,
      }} />
      {/* Label pill — on top of everything */}
      <View style={{
        position: 'absolute', left: cx - 18, top: cy - 10,
        backgroundColor: theme.card, borderRadius: 4,
        borderWidth: 1, borderColor: color,
        paddingHorizontal: 4, paddingVertical: 1,
        zIndex: 11,
      }}>
        <Text style={{ color, fontSize: 8, fontWeight: 'bold' }}>{label}</Text>
      </View>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DataStructureVisualizer({ vars, heap = {}, theme }: Props) {
  const [selected, setSelected] = useState<{ addr: string; node: any } | null>(null);

  // Build localPointers map
  const localPtrs = useMemo(() => {
    const m: Record<string, string[]> = {};
    Object.entries(vars).forEach(([k, v]) => {
      if (isPtr(v)) { if (!m[v.data]) m[v.data] = []; m[v.data].push(k); }
    });
    return m;
  }, [vars]);

  // Identify roots
  const roots = useMemo(() => {
    const r = new Set(Object.keys(localPtrs));
    Object.values(heap).forEach((node: any) => {
      Object.values(getFields(node)).forEach((f: any) => {
        if (isPtr(f)) r.delete(f.data);
      });
    });
    return r.size > 0 ? Array.from(r) : Object.keys(localPtrs);
  }, [localPtrs, heap]);

  const { nodes, edges, w, h } = useMemo(
    () => buildLayout(roots, heap, localPtrs),
    [roots, heap, localPtrs]
  );

  const posMap = useMemo(() => {
    const m: Record<string, Pos> = {};
    nodes.forEach(n => { m[n.addr] = n.pos; });
    return m;
  }, [nodes]);

  const heapCount = Object.keys(heap).length;

  return (
    <View style={[styles.container, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Memory Graph</Text>
        <Text style={{ color: theme.textMuted, fontSize: 9 }}>
          {roots.length} root{roots.length !== 1 ? 's' : ''} · {heapCount} node{heapCount !== 1 ? 's' : ''}
        </Text>
      </View>

      {roots.length === 0 && (
        <View style={styles.empty}>
          <Text style={{ color: theme.textMuted, fontSize: 11 }}>No heap structures at this step</Text>
        </View>
      )}

      {/* Canvas */}
      <ScrollView horizontal showsHorizontalScrollIndicator style={{ maxHeight: 320 }}>
        <ScrollView showsVerticalScrollIndicator>
          <View style={{ width: Math.max(w, 200), height: Math.max(h, 160) }}>
            {/* Edges — canonical perpendicular offset prevents overlap */}
            {(() => {
              // Group edges by canonical pair key (addresses sorted)
              const pairGroups: Record<string, EdgeInfo[]> = {};
              edges.forEach(e => {
                const key = [e.from, e.to].sort().join('||');
                if (!pairGroups[key]) pairGroups[key] = [];
                pairGroups[key].push(e);
              });

              const STEP = 10; // px between parallel lines
              // Map each edge to a precomputed world-space (ox, oy) shift
              const shifts = new Map<EdgeInfo, { ox: number; oy: number }>();

              Object.entries(pairGroups).forEach(([key, group]) => {
                const n = group.length;
                if (n === 1) {
                  shifts.set(group[0], { ox: 0, oy: 0 });
                  return;
                }
                // Canonical direction: from the smaller (sorted-first) addr to the other
                const [addrA, addrB] = key.split('||');
                const pA = posMap[addrA], pB = posMap[addrB];
                if (!pA || !pB) { group.forEach(e => shifts.set(e, { ox: 0, oy: 0 })); return; }

                const ddx = pB.x - pA.x, ddy = pB.y - pA.y;
                const ddist = Math.sqrt(ddx * ddx + ddy * ddy);
                if (ddist < 1) { group.forEach(e => shifts.set(e, { ox: 0, oy: 0 })); return; }

                // Canonical perpendicular (same for ALL edges in this pair)
                const cpx = -ddy / ddist, cpy = ddx / ddist;

                group.forEach((e, i) => {
                  const mag = (i - (n - 1) / 2) * STEP;
                  shifts.set(e, { ox: cpx * mag, oy: cpy * mag });
                });
              });

              return edges.map((e, i) => {
                const fp = posMap[e.from], tp = posMap[e.to];
                if (!fp || !tp) return null;
                return (
                  <Edge
                    key={i}
                    from={fp} to={tp}
                    label={e.label}
                    isCycle={e.isCycle}
                    shift={shifts.get(e)}
                    theme={theme}
                  />
                );
              });
            })()}

            {/* Nodes */}
            {nodes.map(({ addr, pos, varLabels }) => {
              const node = heap[addr];
              const val = primaryValue(node);
              const typeName = node?.name || (node ? 'node' : 'ptr');
              return (
                <View key={addr} style={{ position: 'absolute', left: pos.x - R, top: pos.y - R, alignItems: 'center' }}>
                  {/* Variable label(s) above */}
                  {varLabels.length > 0 && (
                    <View style={styles.varLabels}>
                      {varLabels.map(l => (
                        <Text key={l} style={[styles.varLabel, { color: theme.accent }]}>{l}</Text>
                      ))}
                    </View>
                  )}
                  {/* Circle */}
                  <TouchableOpacity
                    onPress={() => node && setSelected({ addr, node })}
                    activeOpacity={0.75}
                    style={[styles.circle, {
                      backgroundColor: node ? theme.card : theme.background,
                      borderColor: varLabels.length > 0 ? theme.accent : theme.border,
                      borderWidth: varLabels.length > 0 ? 2.5 : 1.5,
                      shadowColor: theme.accent,
                      zIndex: 2,
                    }]}
                  >
                    <Text style={[styles.val, { color: theme.text }]} numberOfLines={2}>{val}</Text>
                    <Text style={[styles.type, { color: theme.textMuted }]}>{typeName}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Detail Modal */}
      {selected && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setSelected(null)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSelected(null)}>
            <View style={[styles.modal, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={{ color: theme.accent, fontWeight: 'bold', fontSize: 14, marginBottom: 2 }}>
                {selected.node?.name || 'node'}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 9, marginBottom: 12 }}>
                {selected.addr}
              </Text>
              {Object.entries(getFields(selected.node)).map(([k, v]: any) => (
                <View key={k} style={styles.modalRow}>
                  <Text style={{ color: theme.textMuted, fontSize: 12 }}>{k}</Text>
                  <Text style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>
                    {isPtr(v) ? `→ ${v.data.slice(-8)}` : String(v?.data ?? '?')}
                  </Text>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: theme.accent }]}
                onPress={() => setSelected(null)}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { maxHeight: 380 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 },
  title: { fontSize: 12, fontWeight: 'bold' },
  empty: { padding: 20, alignItems: 'center' },
  varLabels: { alignItems: 'center', marginBottom: 2 },
  varLabel: { fontSize: 9, fontWeight: 'bold' },
  circle: {
    width: R * 2, height: R * 2, borderRadius: R,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
  val: { fontSize: 17, fontWeight: 'bold', textAlign: 'center' },
  type: { fontSize: 7, marginTop: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  modal: { width: 250, borderRadius: 16, borderWidth: 1, padding: 20 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  closeBtn: { marginTop: 14, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
});
