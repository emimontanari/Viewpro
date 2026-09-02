import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProductListItem } from '../../api/types';
import { QuickStatusSelect } from '../quick-status-select';
import {
  formatPrice,
  getOperationTone,
  getOperationTypeLabel,
  getPropertyTypeLabel
} from './columns';
import { CellAction } from './cell-action';
import { OwnerSummary, PropertyIdentity, PropertyMetric, SellerSummary } from './product-summary';

export function PropertyMobileCards({
  canManageProperties,
  products
}: {
  canManageProperties: boolean;
  products: ProductListItem[];
}) {
  return (
    <div className='grid gap-3 md:hidden'>
      {products.map((product) => (
        <PropertyMobileCard
          key={product.id}
          canManageProperties={canManageProperties}
          propertyEngagement={product}
        />
      ))}
    </div>
  );
}

function PropertyMobileCard({
  canManageProperties,
  propertyEngagement
}: {
  canManageProperties: boolean;
  propertyEngagement: ProductListItem;
}) {
  return (
    <article className='overflow-hidden rounded-2xl border bg-background shadow-xs'>
      <div className='p-4'>
        <div className='flex items-start justify-between gap-3'>
          <PropertyIdentity propertyEngagement={propertyEngagement} compact />
          <CellAction canManageProperties={canManageProperties} data={propertyEngagement} />
        </div>

        <div className='mt-4 flex flex-wrap gap-2'>
          <Badge
            variant='outline'
            className={cn('border', getOperationTone(propertyEngagement.operationType))}
          >
            {getOperationTypeLabel(propertyEngagement.operationType)}
          </Badge>
          <Badge variant='outline'>
            {getPropertyTypeLabel(propertyEngagement.property.propertyType)}
          </Badge>
          <QuickStatusSelect
            canUpdateStatus={canManageProperties}
            propertyEngagement={propertyEngagement}
            size='compact'
          />
        </div>

        <div className='mt-4 grid grid-cols-2 gap-3 text-sm'>
          <PropertyMetric
            label='Precio'
            value={formatPrice(propertyEngagement.publishedPriceCents, propertyEngagement.currency)}
          />
          <SellerSummary propertyEngagement={propertyEngagement} mobile />
          <OwnerSummary propertyEngagement={propertyEngagement} mobile />
          <PropertyMetric
            label='Imágenes'
            value={String(propertyEngagement.property.images.length)}
          />
        </div>
      </div>
    </article>
  );
}
