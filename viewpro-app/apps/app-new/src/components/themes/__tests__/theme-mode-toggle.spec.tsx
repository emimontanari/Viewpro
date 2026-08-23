import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeModeToggle } from '../theme-mode-toggle';

const { setTheme, useTheme } = vi.hoisted(() => ({
  setTheme: vi.fn(),
  useTheme: vi.fn()
}));

vi.mock('next-themes', () => ({ useTheme }));
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe('ThemeModeToggle', () => {
  it.each([
    ['light', 'dark'],
    ['dark', 'light']
  ] as const)(
    'switches resolved %s to explicit %s without a view transition',
    async (resolvedTheme, expectedTheme) => {
      useTheme.mockReturnValue({ resolvedTheme, setTheme });
      const user = userEvent.setup();
      vi.stubGlobal('startViewTransition', undefined);

      render(<ThemeModeToggle />);
      await user.click(screen.getByRole('button', { name: 'Toggle theme' }));

      expect(setTheme).toHaveBeenCalledWith(expectedTheme);
    }
  );
});
