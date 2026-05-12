import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedRun = {
  id: string;
  title: string;
  timestamp: number;
  language: 'python' | 'cpp';
  code: string;
  inputData: string;
  expectedOutput?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
};

const STORAGE_KEY = '@seerun_history_runs';

export const getSavedRuns = async (): Promise<SavedRun[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error("Failed to load saved runs", e);
    return [];
  }
};

export const saveRun = async (
  language: 'python' | 'cpp',
  code: string,
  inputData: string,
  expectedOutput?: string,
  timeComplexity?: string,
  spaceComplexity?: string,
  title?: string
): Promise<void> => {
  try {
    const existingRuns = await getSavedRuns();
    
    // Check if this exact code was the very last thing run to avoid spamming history
    if (existingRuns.length > 0) {
      const lastRun = existingRuns[0];
      if (lastRun.code === code && 
          lastRun.language === language && 
          lastRun.inputData === inputData && 
          lastRun.expectedOutput === expectedOutput &&
          lastRun.timeComplexity === timeComplexity &&
          lastRun.spaceComplexity === spaceComplexity) {
        return; // Skip saving duplicate sequential runs
      }
    }

    const newRun: SavedRun = {
      id: Date.now().toString(),
      title: title || `Run at ${new Date().toLocaleTimeString()}`,
      timestamp: Date.now(),
      language,
      code,
      inputData,
      expectedOutput,
      timeComplexity,
      spaceComplexity,
    };

    // Add to beginning of array, keep only the last 20
    const updatedRuns = [newRun, ...existingRuns].slice(0, 20);
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRuns));
  } catch (e) {
    console.error("Failed to save run", e);
  }
};

export const deleteRun = async (id: string): Promise<void> => {
  try {
    const existingRuns = await getSavedRuns();
    const updatedRuns = existingRuns.filter(run => run.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRuns));
  } catch (e) {
    console.error("Failed to delete run", e);
  }
};

export const clearHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear history", e);
  }
};
