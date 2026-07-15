/**
 * T-24 — RED: AuditPager component tests
 * Spec: platform-audit-log — viewpro-web Global Audit Feed (pagination scenario)
 *
 * Mirrors features/tenants/components/tenants-pager.tsx behavior 1:1
 * (offset/limit, "Mostrando X–Y de Z", Anterior/Siguiente).
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { AuditPager } from '../audit-pager';

describe('AuditPager', () => {
  it('shows "Mostrando X–Y de Z"', () => {
    render(
      <AuditPager offset={0} limit={50} total={120} onPrev={vi.fn()} onNext={vi.fn()} />
    );

    expect(screen.getByText('Mostrando 1–50 de 120')).toBeTruthy();
  });

  it('shows "Mostrando 0–0 de 0" when total is 0', () => {
    render(<AuditPager offset={0} limit={50} total={0} onPrev={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Mostrando 0–0 de 0')).toBeTruthy();
  });

  it('disables "Anterior" when offset is 0', () => {
    render(<AuditPager offset={0} limit={50} total={120} onPrev={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  });

  it('enables "Anterior" when offset > 0', () => {
    render(<AuditPager offset={50} limit={50} total={120} onPrev={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Anterior' })).not.toBeDisabled();
  });

  it('disables "Siguiente" when offset+limit >= total', () => {
    render(<AuditPager offset={100} limit={50} total={120} onPrev={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('enables "Siguiente" when offset+limit < total', () => {
    render(<AuditPager offset={0} limit={50} total={120} onPrev={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Siguiente' })).not.toBeDisabled();
  });

  it('calls onPrev when "Anterior" is clicked', () => {
    const onPrev = vi.fn();
    render(<AuditPager offset={50} limit={50} total={120} onPrev={onPrev} onNext={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onPrev).toHaveBeenCalled();
  });

  it('calls onNext when "Siguiente" is clicked', () => {
    const onNext = vi.fn();
    render(<AuditPager offset={0} limit={50} total={120} onPrev={vi.fn()} onNext={onNext} />);

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onNext).toHaveBeenCalled();
  });

  it('disabled=true disables both buttons regardless of offset/total', () => {
    render(
      <AuditPager
        offset={50}
        limit={50}
        total={120}
        disabled
        onPrev={vi.fn()}
        onNext={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });
});
