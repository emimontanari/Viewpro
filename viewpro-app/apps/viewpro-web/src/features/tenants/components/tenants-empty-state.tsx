'use client';

import { Card, CardContent } from '@/components/ui/card';

/**
 * Rendered when total===0 (D5).
 * This is an expected steady-state, not an error — mirrors metrics-empty-state.tsx.
 */
export function TenantsEmptyState() {
  return (
    <Card className='border-dashed'>
      <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
        <p className='text-muted-foreground text-lg font-medium'>Todavía no hay inmobiliarias</p>
        <p className='text-muted-foreground mt-1 text-sm'>
          Las inmobiliarias aparecerán aquí cuando se registren en la plataforma.
        </p>
      </CardContent>
    </Card>
  );
}
