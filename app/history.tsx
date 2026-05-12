import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { getSavedRuns, deleteRun, SavedRun, clearHistory } from '../utils/storage';

export default function HistoryScreen() {
  const router = useRouter();
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    const saved = await getSavedRuns();
    setRuns(saved);
    setIsLoading(false);
  };

  const handleRunSelect = (run: SavedRun) => {
    // Navigate back to index with the saved code
    router.replace({
      pathname: '/',
      params: { 
        code: run.code, 
        inputData: run.inputData, 
        language: run.language,
        expectedOutput: run.expectedOutput || '',
        timeComplexity: run.timeComplexity || '',
        spaceComplexity: run.spaceComplexity || '',
        fromHistory: 'true' 
      }
    });
  };

  const handleDelete = async (id: string) => {
    await deleteRun(id);
    setRuns(runs.filter(r => r.id !== id));
  };

  const handleClearAll = () => {
    Alert.alert('Clear History', 'Are you sure you want to delete all saved runs?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => {
        await clearHistory();
        setRuns([]);
      }}
    ]);
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const today = new Date();
    const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    
    if (isToday) {
      return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backBtnText}>{"\u2190"}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>History</Text>
        {runs.length > 0 ? (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : runs.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>🕰️</Text>
          <Text style={styles.emptyText}>No saved runs yet.</Text>
          <Text style={styles.emptySubtext}>Your dry runs will automatically appear here when you execute them.</Text>
        </View>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card} 
              onPress={() => handleRunSelect(item)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <View style={[styles.langBadge, item.language === 'cpp' ? styles.langBadgeCpp : styles.langBadgePy]}>
                    <Text style={styles.langBadgeText}>{item.language === 'cpp' ? 'C++' : 'PY'}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.deleteBtn} 
                  onPress={() => handleDelete(item.id)}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.codePreview}>
                <Text style={styles.codePreviewText} numberOfLines={3}>
                  {item.code}
                </Text>
              </View>
              
              <View style={styles.cardFooter}>
                <Text style={styles.timestamp}>{formatDate(item.timestamp)}</Text>
                <Text style={styles.tapToLoad}>Tap to load →</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56, // For safe area
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#F1F5F9', fontSize: 18, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', color: '#F1F5F9' },
  clearBtn: { padding: 8 },
  clearBtnText: { color: '#EF4444', fontSize: 14, fontWeight: '600' },
  
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: { color: '#64748B', fontSize: 16 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { color: '#E2E8F0', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtext: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  listContainer: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  langBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 10 },
  langBadgePy: { backgroundColor: '#1A3A2A' },
  langBadgeCpp: { backgroundColor: '#1A2A3A' },
  langBadgeText: { fontSize: 10, fontWeight: '800', color: '#34D399' },
  cardTitle: { color: '#F1F5F9', fontSize: 16, fontWeight: '700', flex: 1 },
  deleteBtn: { padding: 4, marginLeft: 8 },
  deleteBtnText: { color: '#64748B', fontSize: 14, fontWeight: 'bold' },
  
  codePreview: {
    backgroundColor: '#050B14',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
  },
  codePreviewText: {
    color: '#94A3B8',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: { color: '#475569', fontSize: 12, fontWeight: '500' },
  tapToLoad: { color: '#38BDF8', fontSize: 12, fontWeight: '700' },
});
