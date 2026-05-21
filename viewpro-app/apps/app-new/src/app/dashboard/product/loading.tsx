import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';

export default function Loading() {
  return (
    <PageContainer pageTitle='Propiedades' pageDescription='Gestioná propiedades y operaciones inmobiliarias.'>
      <DataTableSkeleton columnCount={7} filterCount={2} />
    </PageContainer>
  );
}
