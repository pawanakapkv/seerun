import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, ScrollView, FlatList, Platform, StatusBar, KeyboardAvoidingView, Keyboard, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { saveRun } from '../utils/storage';
import CodeEditor from '../components/CodeEditor';
import { detectComplexity } from '../utils/ai';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, History } from 'lucide-react-native';

import { TEMPLATES, TemplateAlgorithm } from '../data/templates';

// ─── Component ────────────────────────────────────────────────────────────────
export default function EditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [language, setLanguage] = useState<'python' | 'cpp'>('python');
  
  // Track the active template so switching languages updates the code correctly
  const [activeTemplate, setActiveTemplate] = useState<TemplateAlgorithm>(TEMPLATES[0].items[1]); // Clone List default
  
  const [pythonCode, setPythonCode] = useState(TEMPLATES[0].items[1].python.code);
  const [cppCode, setCppCode] = useState(TEMPLATES[0].items[1].cpp.code);
  const [pythonInput, setPythonInput] = useState(TEMPLATES[0].items[1].python.input);
  const [cppInput, setCppInput] = useState(TEMPLATES[0].items[1].cpp.input);

  const code = language === 'python' ? pythonCode : cppCode;
  const inputData = language === 'python' ? pythonInput : cppInput;
  const setCode = (val: string) => language === 'python' ? setPythonCode(val) : setCppCode(val);
  const setInputData = (val: string) => language === 'python' ? setPythonInput(val) : setCppInput(val);
  const [expectedOutput, setExpectedOutput] = useState('');
  const [timeComplexity, setTimeComplexity] = useState(TEMPLATES[0].items[1].time || '');
  const [spaceComplexity, setSpaceComplexity] = useState(TEMPLATES[0].items[1].space || '');
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [keyboardPadding, setKeyboardPadding] = useState(40);
  const [isDetecting, setIsDetecting] = useState(false);
  
  const { theme, toggleTheme, isDark } = useTheme();
  const styles = createStyles(theme);
  
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardPadding(350));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardPadding(40));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (params.fromHistory === 'true') {
      const lang = params.language as 'python' | 'cpp';
      if (lang) setLanguage(lang);
      if (params.code) {
        if (lang === 'python') setPythonCode(params.code as string);
        else setCppCode(params.code as string);
      }
      if (params.inputData) {
        if (lang === 'python') setPythonInput(params.inputData as string);
        else setCppInput(params.inputData as string);
      }
      if (params.expectedOutput) setExpectedOutput(params.expectedOutput as string);
      if (params.timeComplexity) setTimeComplexity(params.timeComplexity as string);
      if (params.spaceComplexity) setSpaceComplexity(params.spaceComplexity as string);
      
      // Clear the params to avoid reloading when the component re-mounts
      router.setParams({ fromHistory: undefined });
    }
  }, [params.fromHistory]);

  // Sync code and input when language changes
  const handleLanguageChange = (lang: 'python' | 'cpp') => {
    setLanguage(lang);
  };

  const handleRun = async () => {
    await saveRun(language, code, inputData, expectedOutput, timeComplexity, spaceComplexity, activeTemplate?.name);
    router.push({ pathname: '/visualizer', params: { code, inputData, language, expectedOutput, timeComplexity, spaceComplexity } });
  };

  const handleSelectTemplate = (item: TemplateAlgorithm) => {
    setActiveTemplate(item);
    setPythonCode(item.python.code);
    setCppCode(item.cpp.code);
    setPythonInput(item.python.input);
    setCppInput(item.cpp.input);
    setTimeComplexity(item.time || '');
    setSpaceComplexity(item.space || '');
    setShowTemplates(false);
  };

  const handleAutoDetect = async () => {
    if (!code.trim()) {
      Alert.alert("Empty Code", "Please write some code first to detect complexity.");
      return;
    }
    try {
      setIsDetecting(true);
      const result = await detectComplexity(code);
      if (result.time) setTimeComplexity(result.time);
      if (result.space) setSpaceComplexity(result.space);
    } catch (e: any) {
      Alert.alert("Auto-Detect Failed", e.message || "Failed to analyze code.");
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={{ padding: 16, paddingBottom: keyboardPadding, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>SeeRun</Text>
            <Text style={styles.subtitle}>Visualize your algorithm</Text>
          </View>
          <View style={styles.headerRight}>
            {/* Theme Toggle */}
            <TouchableOpacity 
              style={styles.themeToggleBtn} 
              onPress={toggleTheme} 
              activeOpacity={0.7}
            >
              {isDark ? <Sun size={20} color="#FCD34D" /> : <Moon size={20} color="#1E293B" />}
            </TouchableOpacity>

            {/* Language Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, language === 'python' && styles.toggleBtnActive]}
              onPress={() => handleLanguageChange('python')}
            >
              <Text style={[styles.toggleBtnText, language === 'python' && styles.toggleBtnTextActive]}>Python</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, language === 'cpp' && styles.toggleBtnActive]}
              onPress={() => handleLanguageChange('cpp')}
            >
              <Text style={[styles.toggleBtnText, language === 'cpp' && styles.toggleBtnTextActive]}>C++</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Templates Button Row */}
      <View style={styles.templatesRow}>
        <TouchableOpacity style={styles.templatesBtnFull} onPress={() => setShowTemplates(true)} activeOpacity={0.8}>
          <Text style={styles.templatesBtnTextFull}>📚 Browse Algorithm Templates</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.historyBtn} onPress={() => router.push('/history')} activeOpacity={0.8}>
          <Text style={styles.historyBtnText}>⏱️</Text>
        </TouchableOpacity>
      </View>

      {/* Code Editor Card */}
      <View style={[styles.card, { padding: 0, overflow: 'hidden', minHeight: 350 }]}>
        <View style={{ padding: 12, paddingBottom: 8, backgroundColor: theme.card, zIndex: 10 }}>
          <Text style={[styles.cardLabel, { marginBottom: 0 }]}>Code Editor</Text>
        </View>
        <CodeEditor
          code={code}
          language={language}
          onChangeCode={setCode}
          isDark={isDark}
        />
      </View>

      {/* Input Card */}
      <View style={[styles.card, styles.inputCard]}>
        <Text style={styles.cardLabel}>
          Custom Input{'  '}
          <Text style={styles.optionalTag}>(optional)</Text>
        </Text>
        <TextInput
          style={styles.inputField}
          multiline
          placeholder="Enter input for stdin..."
          placeholderTextColor="#475569"
          value={inputData}
          onChangeText={setInputData}
          onFocus={() => {
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
        />
      </View>

      {/* Expected Output Card */}
      <View style={[styles.card, styles.inputCard]}>
        <Text style={styles.cardLabel}>
          Expected Output{'  '}
          <Text style={styles.optionalTag}>(optional)</Text>
        </Text>
        <TextInput
          style={styles.inputField}
          multiline
          placeholder="Enter expected final output for testing..."
          placeholderTextColor="#475569"
          value={expectedOutput}
          onChangeText={setExpectedOutput}
          onFocus={() => {
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
        />
      </View>

      {/* Complexity Tags */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4, marginTop: 4 }}>
        <Text style={[styles.cardLabel, { marginBottom: 0 }]}>
          Complexity Analysis
        </Text>
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#1E3A8A' }}
          onPress={handleAutoDetect}
          disabled={isDetecting}
          activeOpacity={0.7}
        >
          {isDetecting ? (
            <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 6 }} />
          ) : (
            <Text style={{ fontSize: 14, marginRight: 6 }}>✨</Text>
          )}
          <Text style={{ color: '#38BDF8', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 }}>
            {isDetecting ? "Detecting..." : "Auto-Detect"}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={[styles.card, styles.inputCard, { flex: 1, minHeight: 110 }]}>
          <Text style={styles.cardLabel}>
            Time Comp.{'  '}
            <Text style={styles.optionalTag}>(optional)</Text>
          </Text>
          <TextInput
            style={{ 
              color: theme.text, 
              fontSize: 15, 
              height: 45, 
              backgroundColor: theme.inputBg, 
              borderRadius: 8, 
              paddingHorizontal: 10,
              marginTop: 4
            }}
            placeholder="e.g. O(n)"
            placeholderTextColor={theme.textMuted}
            value={timeComplexity}
            onChangeText={setTimeComplexity}
            onFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
          />
        </View>
        <View style={[styles.card, styles.inputCard, { flex: 1, minHeight: 110 }]}>
          <Text style={styles.cardLabel}>
            Space Comp.{'  '}
            <Text style={styles.optionalTag}>(optional)</Text>
          </Text>
          <TextInput
            style={{ 
              color: theme.text, 
              fontSize: 15, 
              height: 45, 
              backgroundColor: theme.inputBg, 
              borderRadius: 8, 
              paddingHorizontal: 10,
              marginTop: 4
            }}
            placeholder="e.g. O(1)"
            placeholderTextColor={theme.textMuted}
            value={spaceComplexity}
            onChangeText={setSpaceComplexity}
            onFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
          />
        </View>
      </View>

      {/* Run Button */}
      <TouchableOpacity style={styles.runButton} onPress={handleRun} activeOpacity={0.85}>
        <Text style={styles.runButtonText}>▶  Start Dry Run</Text>
      </TouchableOpacity>
      </ScrollView>

      {/* ── Template Modal ── */}
      <Modal visible={showTemplates} animationType="slide" transparent onRequestClose={() => setShowTemplates(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Algorithm Templates</Text>
                <Text style={styles.modalSubtitle}>Both Python & C++ Supported</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowTemplates(false)} activeOpacity={0.8}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Category Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
              {TEMPLATES.map((cat, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.categoryPill, selectedCategory === idx && styles.categoryPillActive]}
                  onPress={() => setSelectedCategory(idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.categoryPillText, selectedCategory === idx && styles.categoryPillTextActive]}>
                    {cat.emoji} {cat.category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Template List */}
            <FlatList
              data={TEMPLATES[selectedCategory].items}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.templateCard} onPress={() => handleSelectTemplate(item)} activeOpacity={0.85}>
                  <View style={styles.templateCardLeft}>
                    <Text style={styles.templateName}>{item.name}</Text>
                    <View style={styles.langBadgeGroup}>
                      <View style={[styles.langBadge, styles.langBadgePy]}>
                        <Text style={styles.langBadgeText}>PY</Text>
                      </View>
                      <View style={[styles.langBadge, styles.langBadgeCpp]}>
                        <Text style={styles.langBadgeText}>C++</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.templateArrow}>→</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingTop: 40,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '900', color: theme.text, letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: theme.textMuted, marginTop: 2, fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  themeToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 100,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  // Templates Button Row
  templatesRow: {
    marginBottom: 16,
    flexDirection: 'row',
    gap: 8,
  },
  templatesBtnFull: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
  },
  templatesBtnTextFull: { color: theme.accentLight, fontWeight: '700', fontSize: 14 },
  historyBtn: {
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  historyBtnText: { fontSize: 16 },

  // Language Toggle
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: 100,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  toggleBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 100 },
  toggleBtnActive: {
    backgroundColor: theme.accent,
    elevation: 3,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  toggleBtnText: { color: theme.textMuted, fontWeight: '700', fontSize: 13 },
  toggleBtnTextActive: { color: '#FFFFFF' },

  // Cards
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: theme.statusBarStyle === 'light' ? 0.3 : 0.1,
    shadowRadius: 8,
  },
  inputCard: { flex: 0, minHeight: 110, maxHeight: 150 },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  optionalTag: { fontSize: 11, color: theme.textMuted, opacity: 0.6, fontWeight: '500', textTransform: 'none', letterSpacing: 0 },

  editor: { fontFamily: 'monospace', color: theme.text, fontSize: 13, flex: 1, textAlignVertical: 'top', lineHeight: 21 },
  inputField: { fontFamily: 'monospace', color: theme.text, fontSize: 13, flex: 1, textAlignVertical: 'top' },

  // Run Button
  runButton: {
    backgroundColor: theme.accent,
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: 'center',
    elevation: 6,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    marginTop: 4,
  },
  runButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17, letterSpacing: 0.5 },

  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: theme.cardBorder,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  modalTitle: { color: theme.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  modalSubtitle: { color: theme.textMuted, fontSize: 12, marginTop: 3 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 100,
    backgroundColor: theme.cardBorder, alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: theme.textDim, fontSize: 14, fontWeight: '700' },

  // Category Pills
  categoryScroll: { flexGrow: 0 },
  categoryPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 100, backgroundColor: theme.background,
    borderWidth: 1, borderColor: theme.cardBorder,
  },
  categoryPillActive: { backgroundColor: theme.accent, borderColor: theme.accentLight },
  categoryPillText: { color: theme.textMuted, fontSize: 12, fontWeight: '700' },
  categoryPillTextActive: { color: '#FFFFFF' },

  // Template Cards
  templateCard: {
    backgroundColor: theme.background,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  templateCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  templateName: { color: theme.text, fontSize: 15, fontWeight: '700' },
  langBadgeGroup: { flexDirection: 'row', gap: 4 },
  langBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  langBadgePy: { backgroundColor: 'rgba(52, 211, 153, 0.1)' },
  langBadgeCpp: { backgroundColor: 'rgba(56, 189, 248, 0.1)' },
  langBadgeText: { fontSize: 9, fontWeight: '800', color: theme.accentLight, letterSpacing: 0.5 },
  templateArrow: { color: theme.accentLight, fontSize: 18, fontWeight: '700' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
