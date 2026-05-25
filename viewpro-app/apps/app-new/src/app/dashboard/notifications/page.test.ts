import { redirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';
import Page from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn()
}));

describe('dashboard notifications route', () => {
  it('redirects to Inicio until ViewPro notifications exist', () => {
    Page();

    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
