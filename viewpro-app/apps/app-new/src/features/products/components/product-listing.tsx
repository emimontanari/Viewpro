import { Suspense } from 'react';
import { ProductTable, PropertyTableSkeleton } from './product-tables';

export default function ProductListingPage() {
  return (
    <Suspense fallback={<PropertyTableSkeleton />}>
      <ProductTable />
    </Suspense>
  );
}
