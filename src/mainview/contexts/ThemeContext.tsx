import React, { createContext, useContext, useEffect } from "react";

interface ThemeContextType {
  isDark: true;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Dark theme only
  useEffect(() => {
    // Apply dark class to html element
    document.documentElement.classList.add("dark");
    return () => {
      // Cleanup if needed
    };
  }, []);

  const value: ThemeContextType = {
    isDark: true,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * テーマコンテキストを使用するフック
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
