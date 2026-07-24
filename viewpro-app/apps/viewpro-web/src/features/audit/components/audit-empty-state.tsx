'use client';

import { Card, CardContent } from '@/components/ui/card';

type Props = {
  /**
   * audit-view (Slice 4, Phase 4), spec "Server-driven filter bar" —
   * Scenario "No rows match filters": total===0 needs TWO distinct
   * messages — the feed has genuinely never recorded anything (unfiltered)
   * vs. these particular filters matched nothing (filtered). Defaults to
   * false so existing callers (none as of this slice) are unaffected.
   */
  filtered?: boolean;
};

/**
 * Rendered when total===0 (spec scenario 4 / Slice 4 filtered scenario).
 * This is an expected steady-state, not an error — mirrors
 * tenants-empty-state.tsx for the unfiltered copy.
 */
export function AuditEmptyState({ filtered = false }: Props) {
  if (filtered) {
    return (
      <Card className='border-dashed' data-testid='audit-empty-state-filtered'>
        <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
          <p className='text-muted-foreground text-lg font-medium'>
            No se encontraron eventos con estos filtros
          </p>
          <p className='text-muted-foreground mt-1 text-sm'>
            Probá ajustar o limpiar los filtros para ver más resultados.
          </p>
        </CardContent>
      </Card>
    );
  }

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
