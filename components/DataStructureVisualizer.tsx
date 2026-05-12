import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ArrowRight, ArrowDown } from 'lucide-react-native';

interface DSVisualizerProps {
  vars: Record<string, any>;
  theme: any;
}

export default function DataStructureVisualizer({ vars, theme }: DSVisualizerProps) {
  // We want to heuristically determine what data structure to draw based on the variables available.
  
  // 1. Linked List Detection (looks for val/nxt or orig_val/orig_nxt)
  const renderLinkedList = (valKey: string, nxtKey: string) => {
    const vals = vars[valKey]?.data || [];
    const nxts = vars[nxtKey]?.data || [];
    
    // Find all pointers that might point to these nodes
    const pointers: Record<string, string[]> = {};
    Object.entries(vars).forEach(([k, v]) => {
      // Exclude obvious non-pointers
      if (['orig_count', 'clone_count', 'n', 'i', 'v', 'node'].includes(k)) return;
      if (k !== valKey && k !== nxtKey && v._type === 'primitive') {
        const valStr = String(v.data);
        if (!pointers[valStr]) pointers[valStr] = [];
        pointers[valStr].push(k);
      }
    });

    // Identify all allocated nodes
    const allocated = new Set<number>();
    for (let i = 0; i < vals.length; i++) {
        if (vals[i] && vals[i].data !== undefined && vals[i].data !== '0') {
            allocated.add(i);
        }
    }

    // Build logical chains
    const chains: number[][] = [];
    const visited = new Set<number>();

    // Helper to extract a chain from a start node
    const extractChain = (startIdx: number) => {
        const chain: number[] = [];
        let curr = startIdx;
        while (curr !== -1 && curr !== undefined && !isNaN(curr) && allocated.has(curr) && !visited.has(curr)) {
            chain.push(curr);
            visited.add(curr);
            const nxtStr = nxts[curr]?.data;
            curr = nxtStr ? parseInt(nxtStr, 10) : -1;
        }
        if (chain.length > 0) chains.push(chain);
    };

    // 1. Start from known head pointers first
    if (valKey === 'orig_val' && vars['head'] && vars['head'].data !== '-1') extractChain(parseInt(vars['head'].data, 10));
    if (valKey === 'clone_val' && vars['cloned_head'] && vars['cloned_head'].data !== '-1') extractChain(parseInt(vars['cloned_head'].data, 10));
    
    // 2. Start from any other active pointers
    Object.keys(pointers).forEach(ptrVal => {
        if (ptrVal !== '-1') extractChain(parseInt(ptrVal, 10));
    });

    // 3. Fallback: Any remaining allocated nodes
    for (const idx of allocated) {
        if (!visited.has(idx)) extractChain(idx);
    }

    if (chains.length === 0) return null;

    return (
      <View key={valKey} style={styles.dsContainer}>
        <Text style={[styles.dsTitle, { color: theme.text }]}>Linked List ({valKey})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {chains.map((chain, chainIdx) => (
            <View key={`chain-${chainIdx}`} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
              {chain.map((idx, i) => {
                const v = vals[idx];
                const nextIdx = nxts[idx]?.data;
                const pt = pointers[String(idx)] || [];
                
                return (
                  <View key={idx} style={styles.llNodeWrapper}>
                    {pt.length > 0 && (
                      <View style={styles.pointersContainer}>
                        {pt.map(p => <Text key={p} style={[styles.pointerText, { color: theme.accent }]}>{p} {"\u2193"}</Text>)}
                      </View>
                    )}
                    <View style={[styles.nodeBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Text style={[styles.nodeIdx, { color: theme.textMuted }]}>[{idx}]</Text>
                      <Text style={[styles.nodeVal, { color: theme.text }]}>{v.data}</Text>
                      <View style={[styles.nodeNext, { backgroundColor: theme.background }]}>
                        <Text style={[styles.nodeNextText, { color: theme.textMuted }]}>{nextIdx}</Text>
                      </View>
                    </View>
                    {/* Only draw an arrow if this node actually points to the NEXT node in our layout chain! */}
                    {i < chain.length - 1 && (
                      <ArrowRight size={20} color={theme.textMuted} style={{ marginHorizontal: 4, marginTop: pt.length > 0 ? 20 : 0 }} />
                    )}
                    {/* If it's the end of a chain but has a next pointer, indicate a jump */}
                    {i === chain.length - 1 && nextIdx !== '-1' && nextIdx !== undefined && (
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Text style={{color: theme.textMuted, fontSize: 10, marginLeft: 4}}>{"\u2192"} [{nextIdx}]</Text>
                        </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  // 2. Standard Array Detection
  const renderArray = (key: string, arrObj: any) => {
    const items = arrObj.data || [];
    if (items.length === 0) return null;
    
    const pointers: Record<string, string[]> = {};
    Object.entries(vars).forEach(([k, v]) => {
      if (v._type === 'primitive' && k !== key) {
        const valStr = String(v.data);
        if (!pointers[valStr]) pointers[valStr] = [];
        pointers[valStr].push(k);
      }
    });

    return (
      <View style={styles.dsContainer} key={key}>
        <Text style={[styles.dsTitle, { color: theme.text }]}>Array: {key}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {items.map((v: any, idx: number) => {
            const pt = pointers[String(idx)] || [];
            return (
              <View key={idx} style={styles.arrNodeWrapper}>
                {pt.length > 0 && (
                  <View style={styles.pointersContainer}>
                    {pt.map(p => <Text key={p} style={[styles.pointerText, { color: theme.accent }]}>{p} {"\u2193"}</Text>)}
                  </View>
                )}
                <View style={[styles.arrBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.nodeVal, { color: theme.text }]}>{v.data}</Text>
                </View>
                <Text style={[styles.arrIdx, { color: theme.textMuted }]}>{idx}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // Execute heuristics
  const renderedItems = [];
  const processedKeys = new Set<string>();

  // Detect linked lists
  const valKeys = Object.keys(vars).filter(k => k.includes('val'));
  valKeys.forEach(vk => {
    const prefix = vk.split('val')[0];
    const nxk = prefix + 'nxt';
    if (vars[nxk] && vars[vk]._type === 'array' && vars[nxk]._type === 'array') {
      renderedItems.push(renderLinkedList(vk, nxk));
      processedKeys.add(vk);
      processedKeys.add(nxk);
    }
  });

  // Render remaining arrays
  Object.keys(vars).forEach(k => {
    if (!processedKeys.has(k) && vars[k] && vars[k]._type === 'array') {
      const arrData = vars[k].data;
      if (arrData && arrData.length > 0 && arrData.some((x:any) => x.data !== '0')) {
        renderedItems.push(renderArray(k, vars[k]));
      }
    }
  });

  if (renderedItems.length === 0) {
    return null; // Nothing to visualize
  }

  return (
    <View style={styles.container}>
      {renderedItems}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  dsContainer: {
    marginBottom: 16,
  },
  dsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  scrollContent: {
    paddingHorizontal: 12,
    alignItems: 'flex-end', // align bottoms of elements
  },
  llNodeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  arrNodeWrapper: {
    alignItems: 'center',
    marginRight: 4,
  },
  pointersContainer: {
    position: 'absolute',
    top: -24,
    alignItems: 'center',
    width: '100%',
  },
  pointerText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  nodeBox: {
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
    overflow: 'hidden',
  },
  arrBox: {
    borderWidth: 1,
    borderRadius: 6,
    minWidth: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  nodeIdx: {
    fontSize: 10,
    marginTop: 4,
  },
  arrIdx: {
    fontSize: 10,
  },
  nodeVal: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  nodeNext: {
    width: '100%',
    paddingVertical: 2,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  nodeNextText: {
    fontSize: 10,
  }
});
