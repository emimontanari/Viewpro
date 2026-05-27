import { describe, expect, it } from 'vitest';
import { navGroups, ownerNavGroups } from './nav-config';

const navItems = navGroups.flatMap((group) =>
  group.items.flatMap((item) => [item, ...(item.items ?? [])])
);
const navTitles = navItems.map((item) => item.title);

describe('nav config', () => {
  it('points the primary dashboard entry to Inicio', () => {
    expect(navItems).toContainEqual(
      expect.objectContaining({
        title: 'Inicio',
        url: '/dashboard'
      })
    );
  });

  it('does not expose template/demo routes in the customer menu', () => {
    expect(navTitles).not.toEqual(
      expect.arrayContaining(['Forms', 'React Query', 'Icons', 'Exclusive', 'Login'])
    );
  });

  it('uses product-facing Spanish labels for the main workspace areas', () => {
    expect(navTitles).toEqual(
      expect.arrayContaining(['Inicio', 'Propiedades', 'Seguimiento', 'Inmobiliarias', 'Equipo'])
    );
  });

  it('exposes only owner-available routes in the owner menu', () => {
    const ownerItems = ownerNavGroups.flatMap((group) => group.items);

    expect(ownerItems).toEqual([
      expect.objectContaining({
        title: 'Mis propiedades',
        url: '/owner'
      })
    ]);
    expect(ownerItems.map((item) => item.url)).not.toEqual(
      expect.arrayContaining(['/dashboard', '/dashboard/product', '/dashboard/billing'])
    );
  });
});
