import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeType } from '../constants/Colors';

type ThemeContextType = {
  themeName: ThemeType;
  theme: typeof Colors.dark;
  toggleTheme: () => void;
  isDark: boolean;
  fontSize: number;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@seerun_theme';
const FONT_SIZE_STORAGE_KEY = '@seerun_font_size';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeName, setThemeName] = useState<ThemeType>('dark');
  const [fontSize, setFontSize] = useState<number>(14);

  useEffect(() => {
    // Load theme and settings from storage on mount
    const loadSettings = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setThemeName(savedTheme);
        }
        const savedFontSize = await AsyncStorage.getItem(FONT_SIZE_STORAGE_KEY);
        if (savedFontSize) {
          const parsed = parseInt(savedFontSize, 10);
          if (!isNaN(parsed) && parsed >= 10 && parsed <= 20) {
            setFontSize(parsed);
          }
        }
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    };
    loadSettings();
  }, []);

  const toggleTheme = async () => {
    const nextTheme = themeName === 'dark' ? 'light' : 'dark';
    setThemeName(nextTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  };

  const increaseFontSize = async () => {
    setFontSize((prev) => {
      const nextSize = Math.min(prev + 2, 20);
      AsyncStorage.setItem(FONT_SIZE_STORAGE_KEY, nextSize.toString()).catch(e => console.error(e));
      return nextSize;
    });
  };

  const decreaseFontSize = async () => {
    setFontSize((prev) => {
      const nextSize = Math.max(prev - 2, 10);
      AsyncStorage.setItem(FONT_SIZE_STORAGE_KEY, nextSize.toString()).catch(e => console.error(e));
      return nextSize;
    });
  };

  const theme = Colors[themeName];
  const isDark = themeName === 'dark';

  return (
    <ThemeContext.Provider value={{ themeName, theme, toggleTheme, isDark, fontSize, increaseFontSize, decreaseFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
