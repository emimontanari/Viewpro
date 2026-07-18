'use client';

import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import type { TenantListItem } from '@/features/tenants/api/types';
import { planDistribution } from '../lib/aggregations';

type Props = {
  tenants: TenantListItem[];
};

/**
 * Plan coverage across the tenant base, aggregated from TenantListItem.plan.
 * Emits the full plan catalog (Básico / Profesional / Empresa / Sin plan) so
 * the bars keep a stable shape even before plans are assigned.
 */
export function PlanBarChart({ tenants }: Props) {
  const data = planDistribution(tenants);

  const chartConfig: ChartConfig = {
    value: { label: 'Inmobiliarias' },
    ...Object.fromEntries(data.map((bucket) => [bucket.key, { label: bucket.label, color: bucket.fill }]))
  };

  return (
    <Card className='flex h-full flex-col'>
      <CardHeader>
        <CardTitle>Distribución por plan</CardTitle>
        <CardDescription>Inmobiliarias por plan comercial asignado</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-4'>
        <ChartContainer config={chartConfig} className='max-h-[240px] w-full'>
          <BarChart accessibilityLayer data={data} layout='vertical' margin={{ left: 8 }}>
            <YAxis
              dataKey='label'
              type='category'
              tickLine={false}
              axisLine={false}
              width={90}
              tickMargin={8}
            />
            <XAxis type='number' hide allowDecimals={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey='label' hideLabel />} />
            <Bar dataKey='value' radius={4}>
              {data.map((bucket) => (
                <Cell key={bucket.key} fill={bucket.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        <ul className='flex flex-col gap-2'>
          {data.map((bucket) => (
            <li
              key={bucket.key}
              data-testid={`plan-legend-${bucket.key}`}
              className='flex items-center justify-between gap-2 text-sm'
            >
              <span className='flex items-center gap-2'>
                <span
                  aria-hidden
                  className='size-2.5 rounded-[2px]'
                  style={{ backgroundColor: bucket.fill }}
                />
                <span className='text-muted-foreground'>{bucket.label}</span>
              </span>
              <span className='font-medium tabular-nums'>{bucket.value}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
