import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ThemeProvider from '../theme-provider';

let capturedProps: Record<string, unknown> | undefined;

vi.mock('next-themes', () => ({
  ThemeProvider: (props: Record<string, unknown>) => {
    capturedProps = props;
    return props.children;
  }
}));

describe('ThemeProvider', () => {
  it('owns the light fallback and system support while forwarding caller props', () => {
    render(
      <ThemeProvider attribute='class' disableTransitionOnChange>
        <span>application</span>
      </ThemeProvider>
    );

    expect(capturedProps).toMatchObject({
      attribute: 'class',
      defaultTheme: 'light',
      disableTransitionOnChange: true,
      enableSystem: true
    });
    expect(capturedProps?.children).toEqual(<span>application</span>);
  });
});
