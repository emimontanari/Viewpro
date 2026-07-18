'use client';

import { Card, CardContent } from '@/components/ui/card';

/**
 * Rendered when the operator roster is empty (mirrors TenantsEmptyState).
 * In practice this should never be reachable in production — the seed
 * script always creates the first OWNER — but the container renders it
 * defensively for total===0 rather than an empty table.
 */
export function OperatorsEmptyState() {
  return (
    <Card className='border-dashed'>
      <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
        <p className='text-muted-foreground text-lg font-medium'>Todavía no hay operadores</p>
        <p className='text-muted-foreground mt-1 text-sm'>
          Creá el primer operador para empezar a gestionar la plataforma.
        </p>
      </CardContent>
    </Card>
  );
}
