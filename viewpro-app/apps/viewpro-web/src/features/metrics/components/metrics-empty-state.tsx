'use client';

import { Card, CardContent } from '@/components/ui/card';

/**
 * Rendered when tenants===0 or byStatus is empty (D11).
 * This is an expected steady-state, not an error.
 */
export function MetricsEmptyState() {
  return (
    <Card className='border-dashed'>
      <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
        <p className='text-muted-foreground text-lg font-medium'>Todavía no hay métricas</p>
        <p className='text-muted-foreground mt-1 text-sm'>
          Las métricas aparecerán cuando se registren inmobiliarias en la plataforma.
        </p>
      </CardContent>
    </Card>
  );
}
