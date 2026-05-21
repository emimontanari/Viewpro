import FormCardSkeleton from '@/components/form-card-skeleton';
import PageContainer from '@/components/layout/page-container';

export default function Loading() {
  return (
    <PageContainer>
      <div className='flex-1 space-y-4'>
        <FormCardSkeleton />
      </div>
    </PageContainer>
  );
}
