import { redirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';
import Page from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn()
}));

describe('dashboard billing route', () => {
  it('redirects to Inicio instead of rendering the billing placeholder', () => {
    Page();

    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
