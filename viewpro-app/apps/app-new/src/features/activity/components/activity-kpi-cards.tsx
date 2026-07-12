import { Icons } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
import type { ActivityFeedCounters } from '../api/types';

export function ActivityKpiCards({
  counters,
  isLoading
}: {
  counters: ActivityFeedCounters | undefined;
  isLoading: boolean;
}) {
  const cards = [
    {
      title: 'Movimientos hoy',
      description: 'Actualizaciones registradas en las últimas 24 horas.',
      value: counters?.todayCount,
      icon: Icons.clock
    },
    {
      title: 'Sin actualización',
      description: 'Propiedades activas sin novedades recientes.',
      value: counters?.staleCount,
      icon: Icons.warning
    },
    {
      title: 'Requieren atención',
      description: 'Consultas, visitas u ofertas sin próximo paso.',
      value: counters?.attentionCount,
      icon: Icons.trendingUp
    }
  ];

  return (
    <div className='grid gap-3 md:grid-cols-3'>
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.title} className='overflow-hidden py-0'>
            <CardContent className='flex items-start gap-4 p-5'>
              <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'>
                <Icon className='size-5' />
              </div>
              <div className='min-w-0 space-y-1'>
                <p className='text-sm font-medium text-muted-foreground'>{card.title}</p>
                {isLoading ? (
                  <div className='h-8 w-16 animate-pulse rounded bg-muted' />
                ) : (
                  <p className='text-3xl font-semibold tracking-tight'>{card.value ?? 0}</p>
                )}
                <p className='text-sm text-muted-foreground'>{card.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
