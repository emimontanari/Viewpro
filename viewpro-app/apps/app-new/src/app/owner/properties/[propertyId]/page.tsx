import { OwnerPropertyDetail } from '@/features/owner/components/owner-property-detail';

type PageProps = { params: Promise<{ propertyId: string }> };

export default async function OwnerPropertyPage({ params }: PageProps) {
  const { propertyId } = await params;

  return <OwnerPropertyDetail propertyId={propertyId} />;
}
