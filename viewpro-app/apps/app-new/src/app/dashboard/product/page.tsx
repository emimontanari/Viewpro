import PageContainer from '@/components/layout/page-container';
import { productInfoContent } from '@/config/infoconfig';
import { ProductPageHeaderAction } from '@/features/products/components/product-page-header-action';
import ProductListingPage from '@/features/products/components/product-listing';
import { searchParamsCache } from '@/lib/searchparams';
import type { SearchParams } from 'nuqs/server';

export const metadata = {
  title: 'Dashboard: Propiedades'
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  searchParamsCache.parse(searchParams);

  return (
    <PageContainer
      pageTitle='Propiedades'
      pageDescription='Gestioná propiedades y operaciones inmobiliarias.'
      infoContent={productInfoContent}
      pageHeaderAction={<ProductPageHeaderAction />}
    >
      <ProductListingPage />
    </PageContainer>
  );
}
