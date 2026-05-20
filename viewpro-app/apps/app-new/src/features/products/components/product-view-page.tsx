'use client';

import FormCardSkeleton from '@/components/form-card-skeleton';
import { useSelectedTenantId } from '@/lib/tenant-selection';
import { useQuery } from '@tanstack/react-query';
import type { Product, ProductByIdResponse } from '../api/types';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductForm from './product-form';
import { productByIdOptions } from '../api/queries';

type ProductViewMode = 'detail' | 'edit';

type TProductViewPageProps = {
  productId: string;
  mode?: ProductViewMode;
};

export default function ProductViewPage({ productId, mode = 'detail' }: TProductViewPageProps) {
  const selectedTenantId = useSelectedTenantId();

  if (!selectedTenantId) {
    return <MissingTenantState />;
  }

  if (productId === 'new') {
    return <ProductForm initialData={null} mode='create' pageTitle='Crear propiedad' />;
  }

  return <ExistingProductView mode={mode} productId={productId} selectedTenantId={selectedTenantId} />;
}

function ExistingProductView({
  mode,
  productId,
  selectedTenantId
}: {
  mode: ProductViewMode;
  productId: string;
  selectedTenantId: string;
}) {
  const productQuery = useQuery(productByIdOptions(productId, selectedTenantId));

  if (productQuery.isLoading) {
    return <FormCardSkeleton />;
  }

  if (productQuery.isError) {
    return (
      <div className='text-destructive rounded-md border border-dashed p-6 text-sm'>
        No se pudo cargar la propiedad.
      </div>
    );
  }

  const product = productQuery.data;

  if (!product || !isPropertyEngagement(product)) {
    notFound();
  }

  return (
    <ProductForm
      initialData={product}
      mode={mode}
      pageTitle={mode === 'edit' ? 'Editar propiedad' : 'Detalle de propiedad'}
    />
  );
}

function MissingTenantState() {
  return (
    <div className='rounded-md border border-dashed p-6 text-sm'>
      <div className='space-y-2'>
        <h2 className='text-base font-semibold'>Seleccioná una inmobiliaria</h2>
        <p className='text-muted-foreground'>
          Elegí una inmobiliaria para crear, editar o ver propiedades.
        </p>
        <Link
          href='/dashboard/workspaces'
          className='text-primary inline-flex font-medium underline-offset-4 hover:underline'
        >
          Ir a inmobiliarias
        </Link>
      </div>
    </div>
  );
}

function isPropertyEngagement(value: ProductByIdResponse): value is Product {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'id' in value &&
    'property' in value &&
    typeof (value as Product).id === 'string'
  );
}
