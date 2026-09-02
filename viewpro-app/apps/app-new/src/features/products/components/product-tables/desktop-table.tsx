import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Row } from '@tanstack/react-table';
import type { ProductListItem } from '../../api/types';
import { QuickStatusSelect } from '../quick-status-select';
import {
  formatPrice,
  getOperationTone,
  getOperationTypeLabel,
  getPropertyTypeLabel
} from './columns';
import { CellAction } from './cell-action';
import { OwnerSummary, PropertyIdentity, SellerSummary } from './product-summary';

export function PropertyDesktopTable({
  canManageProperties,
  rows
}: {
  canManageProperties: boolean;
  rows: Row<ProductListItem>[];
}) {
  return (
    <div className='hidden min-w-0 overflow-hidden rounded-2xl border bg-background shadow-xs md:block'>
      <Table className='table-fixed'>
        <TableHeader className='bg-muted/40'>
          <TableRow className='hover:bg-transparent'>
            <TableHead className='w-[35%] px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground'>
              Propiedad
            </TableHead>
            <TableHead className='w-28 px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground'>
              Operación
            </TableHead>
            <TableHead className='w-36 px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground'>
              Estado
            </TableHead>
            <TableHead className='w-28 px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground'>
              Precio
            </TableHead>
            <TableHead className='w-36 px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground'>
              Propietario
            </TableHead>
            <TableHead className='hidden w-36 px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground 2xl:table-cell'>
              Vendedor
            </TableHead>
            <TableHead className='w-12 px-3 py-3' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <PropertyTableRow
              key={row.id}
              canManageProperties={canManageProperties}
              propertyEngagement={row.original}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PropertyTableRow({
  canManageProperties,
  propertyEngagement
}: {
  canManageProperties: boolean;
  propertyEngagement: ProductListItem;
}) {
  return (
    <TableRow className='group hover:bg-muted/30'>
      <TableCell className='whitespace-normal px-3 py-3'>
        <PropertyIdentity propertyEngagement={propertyEngagement} compact />
      </TableCell>
      <TableCell className='px-3 py-3'>
        <div className='flex flex-col gap-1.5'>
          <Badge
            variant='outline'
            className={cn('border', getOperationTone(propertyEngagement.operationType))}
          >
            {getOperationTypeLabel(propertyEngagement.operationType)}
          </Badge>
          <Badge
            variant='outline'
            className='hidden bg-background text-muted-foreground 2xl:inline-flex'
          >
            {getPropertyTypeLabel(propertyEngagement.property.propertyType)}
          </Badge>
        </div>
      </TableCell>
      <TableCell className='px-3 py-3'>
        <QuickStatusSelect
          canUpdateStatus={canManageProperties}
          propertyEngagement={propertyEngagement}
        />
      </TableCell>
      <TableCell className='whitespace-nowrap px-3 py-3 font-medium'>
        {formatPrice(propertyEngagement.publishedPriceCents, propertyEngagement.currency)}
      </TableCell>
      <TableCell className='whitespace-normal px-3 py-3'>
        <OwnerSummary propertyEngagement={propertyEngagement} />
      </TableCell>
      <TableCell className='hidden whitespace-normal px-3 py-3 2xl:table-cell'>
        <SellerSummary propertyEngagement={propertyEngagement} />
      </TableCell>
      <TableCell className='px-3 py-3 text-right'>
        <CellAction canManageProperties={canManageProperties} data={propertyEngagement} />
      </TableCell>
    </TableRow>
  );
}
