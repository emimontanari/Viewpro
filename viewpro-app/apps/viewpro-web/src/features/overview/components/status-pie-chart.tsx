'use client';

import { Label, Pie, PieChart } from 'recharts';

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
import type { MetricsSummary } from '@/features/metrics/api/types';
import { statusDistribution } from '../lib/aggregations';

type Props = {
  byStatus: MetricsSummary['byStatus'];
};

/**
 * Donut of tenants by lifecycle status, fed by metrics.byStatus (open map, D11).
 * The recharts donut is the visual; the accessible legend list underneath
 * carries the semantic label + count for each slice.
 */
export function StatusPieChart({ byStatus }: Props) {
  const data = statusDistribution(byStatus);
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  const chartConfig: ChartConfig = Object.fromEntries(
    data.map((slice) => [slice.key, { label: slice.label, color: slice.fill }])
  );

  return (
    <Card className='flex h-full flex-col'>
      <CardHeader>
        <CardTitle>Distribución por estado</CardTitle>
        <CardDescription>Inmobiliarias según su estado en la plataforma</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-4'>
        <ChartContainer
          config={chartConfig}
          className='mx-auto aspect-square h-[240px] w-[240px]'
        >
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey='key' hideLabel />} />
            <Pie data={data} dataKey='value' nameKey='key' innerRadius={55} strokeWidth={4}>
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !('cx' in viewBox)) return null;
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor='middle' dominantBaseline='middle'>
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className='fill-foreground text-3xl font-bold'
                      >
                        {total}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 22}
                        className='fill-muted-foreground text-xs'
                      >
                        Total
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <ul className='flex flex-col gap-2'>
          {data.map((slice) => (
            <li
              key={slice.key}
              data-testid={`status-legend-${slice.key}`}
              className='flex items-center justify-between gap-2 text-sm'
            >
              <span className='flex items-center gap-2'>
                <span
                  aria-hidden
                  className='size-2.5 rounded-[2px]'
                  style={{ backgroundColor: slice.fill }}
                />
                <span className='text-muted-foreground'>{slice.label}</span>
              </span>
              <span className='font-medium tabular-nums'>{slice.value}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
