'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

const UUID_SEGMENT_PATTERN = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const BREADCRUMB_ID_PREVIEW_LENGTH = 5;

// This allows to add custom title as well
const routeMapping: Record<string, BreadcrumbItem[]> = {
  '/owner': [{ title: 'Mis propiedades', link: '/owner' }],
  '/dashboard': [{ title: 'Dashboard', link: '/dashboard' }],
  '/dashboard/employee': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Employee', link: '/dashboard/employee' }
  ],
  '/dashboard/product': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Product', link: '/dashboard/product' }
  ]
  // Add more custom mappings as needed
};

export function useBreadcrumbs() {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    // Check if we have a custom mapping for this exact path
    if (routeMapping[pathname]) {
      return routeMapping[pathname];
    }

    if (pathname.startsWith('/owner/properties/')) {
      return [
        { title: 'Mis propiedades', link: '/owner' },
        { title: 'Detalle', link: pathname }
      ];
    }

    // If no exact match, fall back to generating breadcrumbs from the path
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      return {
        title: getBreadcrumbTitle(segment),
        link: path
      };
    });
  }, [pathname]);

  return breadcrumbs;
}

function getBreadcrumbTitle(segment: string) {
  if (UUID_SEGMENT_PATTERN.test(segment)) {
    return segment.slice(0, BREADCRUMB_ID_PREVIEW_LENGTH);
  }

  const labels: Record<string, string> = {
    owner: 'Mis propiedades'
  };

  return labels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}
