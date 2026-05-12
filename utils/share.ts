import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { captureRef } from 'react-native-view-shot';
import { Platform } from 'react-native';

/**
 * Exports the full trace of an algorithm dry run as a beautified JSON file.
 */
export async function shareTraceAsJSON(
  name: string,
  code: string,
  language: string,
  trace: any[],
  complexity: { time: string; space: string }
) {
  const sessionData = {
    algorithm: name || 'Custom Algorithm',
    date: new Date().toLocaleString(),
    metadata: {
      language,
      timeComplexity: complexity.time || 'N/A',
      spaceComplexity: complexity.space || 'N/A',
    },
    code,
    trace,
    application: 'SeeRun Algorithmic Visualizer'
  };

  // Sanitize filename to prevent illegal characters
  const safeName = String(name || 'Algorithm').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileName = `SeeRun_${safeName}_${Date.now()}.json`;
  const fileUri = FileSystem.cacheDirectory + fileName;

  try {
    const jsonString = JSON.stringify(sessionData, null, 2);
    await FileSystem.writeAsStringAsync(fileUri, jsonString);

    if (!(await Sharing.isAvailableAsync())) {
      alert("Sharing is not available on this platform");
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Algorithm Trace',
      UTI: 'public.json'
    });
  } catch (error) {
    console.error('Error sharing trace:', error);
    alert('Failed to export trace JSON');
  }
}

/**
 * Captures a visual snapshot of a specific component and shares it as an image.
 */
export async function shareStepAsImage(viewRef: any, stepNumber: number) {
  try {
    if (!viewRef.current) return;

    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 0.9,
      result: 'tmpfile'
    });

    if (!(await Sharing.isAvailableAsync())) {
      alert("Sharing is not available on this platform");
      return;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: `SeeRun Step ${stepNumber} Snapshot`,
      UTI: 'public.png'
    });
  } catch (error) {
    console.error('Error sharing image:', error);
    alert('Failed to capture snapshot');
  }
}
