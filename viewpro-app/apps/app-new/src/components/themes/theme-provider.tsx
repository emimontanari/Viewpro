'use client';

import { COLOR_MODE_POLICY } from '@/components/themes/color-mode';
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

type AppThemeProviderProps = Omit<ThemeProviderProps, 'defaultTheme' | 'enableSystem'>;

export default function ThemeProvider({ children, ...props }: AppThemeProviderProps) {
  return (
    <NextThemesProvider
      {...props}
      defaultTheme={COLOR_MODE_POLICY.defaultMode}
      enableSystem={COLOR_MODE_POLICY.enableSystem}
    >
      {children}
    </NextThemesProvider>
  );
}
