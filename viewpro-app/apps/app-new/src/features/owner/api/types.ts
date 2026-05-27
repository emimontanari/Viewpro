export type OwnerPropertyImage = {
  id: string;
  storageKey: string;
  url: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OwnerProperty = {
  id: string;
  title: string;
  addressLine: string;
  city: string;
  province: string;
  propertyType: string;
  totalAreaSqm: number | null;
  coveredAreaSqm: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  ageYears: number | null;
  orientation: string | null;
  images: OwnerPropertyImage[];
  primaryImage: OwnerPropertyImage | null;
  createdAt: string;
  updatedAt: string;
};

export type OwnerAgent = {
  userId: string;
  firstName: string;
  email: string;
};

export type OwnerEngagement = {
  id: string;
  tenant: {
    id: string;
    name: string;
  };
  operationType: string;
  status: string;
  publishedPriceCents: number;
  currency: string;
  agents: OwnerAgent[];
  createdAt: string;
  updatedAt: string;
};

export type OwnerMovement = {
  id: string;
  propertyEngagementId: string;
  type: string;
  observation: string;
  nextStep: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  source: string;
  interestCount: number | null;
  visitCount: number | null;
  offerAmountCents: number | null;
  interestLevel: string | null;
  createdBy: {
    id: string;
    email: string;
    firstName: string;
  };
  createdAt: string;
};

export type OwnerPropertiesResponse = OwnerProperty[];

export type OwnerEngagementsResponse = OwnerEngagement[];

export type OwnerTimelineFilters = {
  page?: number;
  pageSize?: number;
  order?: 'asc' | 'desc';
};

export type OwnerTimelineResponse = {
  engagement: OwnerEngagement;
  items: OwnerMovement[];
  total: number;
  page: number;
  pageSize: number;
};
