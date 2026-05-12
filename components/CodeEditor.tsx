import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface CodeEditorProps {
  code: string;
  language: 'python' | 'cpp';
  onChangeCode: (code: string) => void;
  isDark: boolean;
}

export default function CodeEditor({ code, language, onChangeCode, isDark }: CodeEditorProps) {
  const webviewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);

  // Map our language to CodeMirror modes
  const getMode = (lang: string) => {
    return lang === 'cpp' ? 'text/x-c++src' : 'text/x-python';
  };

  const bg = isDark ? '#0F172A' : '#F8FAFC';
  const text = isDark ? '#F8FAFC' : '#0F172A';
  const gutterBg = isDark ? '#0F172A' : '#F1F5F9';
  const gutterBorder = isDark ? '#1E293B' : '#E2E8F0';
  const cursor = isDark ? '#38BDF8' : '#2563EB';
  const activeLine = isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(37, 99, 235, 0.05)';
  const selection = isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(37, 99, 235, 0.15)';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400&display=swap" rel="stylesheet">
  
  <!-- CodeMirror CSS -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css">
  
  <!-- CodeMirror Core & Addons -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/matchbrackets.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/edit/closebrackets.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/addon/selection/active-line.min.js"></script>
  
  <!-- Language Modes -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/python/python.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/clike/clike.min.js"></script>

  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      background-color: ${bg};
      overflow: hidden;
    }
    .CodeMirror {
      height: 100%;
      font-size: 14px;
      font-family: 'JetBrains Mono', monospace;
      background-color: transparent !important;
      color: ${text} !important;
      line-height: 1.6;
    }
    
    /* Gutter / Line Numbers */
    .CodeMirror-gutters {
      background-color: ${gutterBg} !important;
      border-right: 1px solid ${gutterBorder} !important;
    }
    .CodeMirror-linenumber {
      color: ${isDark ? '#475569' : '#94A3B8'} !important;
      padding-right: 12px !important;
    }
    
    /* Cursor */
    .CodeMirror-cursor {
      border-left: 2px solid ${cursor} !important;
    }
    
    /* Active Line */
    .CodeMirror-activeline-background {
      background: ${activeLine} !important; 
    }
    .CodeMirror-activeline-gutter {
      background: ${activeLine} !important;
    }
    
    /* Selection */
    .CodeMirror-selected {
      background: ${selection} !important;
    }
    
    /* --- Syntax Highlighting --- */
    .cm-s-custom .cm-keyword { color: ${isDark ? '#F472B6' : '#DB2777'} !important; font-weight: 500; }
    .cm-s-custom .cm-def { color: ${isDark ? '#38BDF8' : '#0284C7'} !important; font-weight: 700; }
    .cm-s-custom .cm-variable { color: ${isDark ? '#E2E8F0' : '#1E293B'} !important; }
    .cm-s-custom .cm-variable-2 { color: ${isDark ? '#BAE6FD' : '#0EA5E9'} !important; }
    .cm-s-custom .cm-string { color: ${isDark ? '#FCD34D' : '#D97706'} !important; }
    .cm-s-custom .cm-number { color: ${isDark ? '#C084FC' : '#7C3AED'} !important; }
    .cm-s-custom .cm-comment { color: ${isDark ? '#64748B' : '#94A3B8'} !important; font-style: italic; }
    .cm-s-custom .cm-builtin { color: ${isDark ? '#34D399' : '#059669'} !important; }
    .cm-s-custom .cm-operator { color: ${isDark ? '#F472B6' : '#DB2777'} !important; }
    .cm-s-custom .cm-property { color: ${isDark ? '#7DD3FC' : '#0369A1'} !important; }
    .cm-s-custom .cm-type { color: ${isDark ? '#C084FC' : '#7C3AED'} !important; font-weight: 500; }
    .cm-s-custom .cm-meta { color: ${isDark ? '#34D399' : '#059669'} !important; }
    
    /* Bracket Matching */
    div.CodeMirror span.CodeMirror-matchingbracket {
      color: ${cursor} !important;
      font-weight: 900 !important;
      border-bottom: 2px solid ${cursor};
      background-color: rgba(56, 189, 248, 0.15);
    }

    /* Custom Scrollbar */
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: ${bg}; }
    ::-webkit-scrollbar-thumb { background: ${isDark ? '#334155' : '#CBD5E1'}; border-radius: 5px; }
  </style>
</head>
<body>
  <textarea id="editor"></textarea>
  <script>
    var initialCode = decodeURIComponent("${encodeURIComponent(code)}");
    var mode = "${getMode(language)}";

    var editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
      lineNumbers: true,
      mode: mode,
      theme: "custom",
      matchBrackets: true,
      autoCloseBrackets: true,
      styleActiveLine: true,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      lineWrapping: true
    });

    editor.setValue(initialCode);

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));

    editor.on('change', function(cm, changeObj) {
      if (changeObj.origin !== 'setValue') {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'code_change',
          code: cm.getValue()
        }));
      }
    });

    window.updateCode = function(newCode) {
      if (editor.getValue() !== newCode) {
        var cursor = editor.getCursor();
        editor.setValue(newCode);
        editor.setCursor(cursor);
      }
    };

    window.updateMode = function(newMode) {
      editor.setOption('mode', newMode);
    };
  </script>
</body>
</html>
  `;

  // Update language dynamically
  useEffect(() => {
    if (isReady && webviewRef.current) {
      const mode = getMode(language);
      webviewRef.current.injectJavaScript(`window.updateMode && window.updateMode('${mode}'); true;`);
    }
  }, [language, isReady]);

  // Update code dynamically
  useEffect(() => {
    if (isReady && webviewRef.current) {
      const safeCode = encodeURIComponent(code);
      webviewRef.current.injectJavaScript(`window.updateCode && window.updateCode(decodeURIComponent('${safeCode}')); true;`);
    }
  }, [code, isReady]);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {!isReady && (
        <View style={[styles.loadingOverlay, { backgroundColor: bg }]}>
          <ActivityIndicator size="small" color={cursor} />
        </View>
      )}
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: 'https://localhost' }}
        style={[styles.webview, { backgroundColor: bg }]}
        scrollEnabled={false}
        bounces={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'ready') {
              setIsReady(true);
            } else if (data.type === 'code_change') {
              onChangeCode(data.code);
            }
          } catch (e) {
            console.error("WebView Message Error:", e);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  }
});
