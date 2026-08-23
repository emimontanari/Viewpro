import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useThemeSwitching from './use-theme-switching';

const { setTheme, useRegisterActions, useTheme, useThemeConfig } = vi.hoisted(() => ({
  setTheme: vi.fn(),
  useRegisterActions: vi.fn(),
  useTheme: vi.fn(),
  useThemeConfig: vi.fn()
}));

vi.mock('kbar', () => ({ useRegisterActions }));
vi.mock('next-themes', () => ({ useTheme }));
vi.mock('@/components/themes/active-theme', () => ({ useThemeConfig }));

type ThemeAction = { id: string; perform: () => void };

describe('useThemeSwitching', () => {
  it('registers explicit light and dark actions with exact theme requests', () => {
    useTheme.mockReturnValue({ theme: 'system', setTheme });
    useThemeConfig.mockReturnValue({ activeTheme: 'inmoview', setActiveTheme: vi.fn() });

    renderHook(() => useThemeSwitching());

    const actions = useRegisterActions.mock.calls[0][0] as ThemeAction[];
    actions.find(({ id }) => id === 'setLightTheme')?.perform();
    actions.find(({ id }) => id === 'setDarkTheme')?.perform();

    expect(setTheme).toHaveBeenNthCalledWith(1, 'light');
    expect(setTheme).toHaveBeenNthCalledWith(2, 'dark');
  });
});
