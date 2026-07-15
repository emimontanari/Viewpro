'use client';

import { Card, CardContent } from '@/components/ui/card';

/**
 * Rendered when total===0 (spec scenario 4).
 * This is an expected steady-state, not an error — mirrors tenants-empty-state.tsx.
 */
export function AuditEmptyState() {
  return (
    <Card className='border-dashed'>
      <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
        <p className='text-muted-foreground text-lg font-medium'>
          Todavía no hay eventos de auditoría
        </p>
        <p className='text-muted-foreground mt-1 text-sm'>
          Los eventos aparecerán aquí a medida que se realicen cambios en la plataforma.
        </p>
      </CardContent>
    </Card>
  );
}
