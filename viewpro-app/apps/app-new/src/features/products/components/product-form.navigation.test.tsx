import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../api/types';
import ProductForm from './product-form';

const state = vi.hoisted(() => ({
  manager: true,
  pending: false,
  routerPush: vi.fn()
}));

vi.mock('@/lib/session-context', () => ({ useActiveTenant: () => ({ activeMembership: {} }) }));
vi.mock('@/lib/session', () => ({
  canManagePropertyEngagements: () => state.manager,
  canReviewTenantDocuments: () => state.manager,
  hasTenantPermission: (_membership: unknown, permission: string) =>
    permission === 'movements:create' || permission === 'documents:request',
  TENANT_PERMISSIONS: {
    MOVEMENTS_CREATE: 'movements:create',
    DOCUMENTS_REQUEST: 'documents:request'
  }
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.routerPush }) }));
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() })
  };
});
vi.mock('@/features/status-change-requests/api/queries', () => ({
  useStatusChangeRequestsByEngagement: () => ({
    data: state.pending ? [{ status: 'PENDING', requestedByUserId: 'seller' }] : []
  }),
  useApproveStatusChangeRequest: () => ({}),
  useRejectStatusChangeRequest: () => ({})
}));
vi.mock('./use-property-movements-controller', () => ({
  usePropertyMovementsController: () => ({
    isError: false,
    isLoading: false,
    items: [],
    isCreatingMovement: false,
    setDialogOpen: vi.fn(),
    dialogOpen: false,
    handleCreateMovement: vi.fn()
  })
}));
vi.mock('./create-property-movement-dialog', () => ({ CreatePropertyMovementDialog: () => null }));
vi.mock('./property-images', () => ({
  PropertyImageCarousel: () => <section aria-label='Imágenes de la propiedad' />
}));
vi.mock('./property-detail-summary', () => ({
  PropertyDetailHeader: ({ canEdit, onEdit }: { canEdit: boolean; onEdit: () => void }) => (
    <header>{canEdit && <button onClick={onEdit}>Editar propiedad</button>}</header>
  ),
  PropertyReadOnlySections: ({ className }: { className?: string }) => (
    <section aria-label='Datos de la propiedad' className={className}>
      <p>Av. Siempre Viva 742</p>
    </section>
  )
}));
vi.mock('./property-status-summary', () => ({
  PropertyStatusSummary: ({
    canUpdateStatus,
    isArchived
  }: {
    canUpdateStatus: boolean;
    isArchived: boolean;
  }) => (
    <section aria-label='Estado de la propiedad'>
      Estado comercial · {canUpdateStatus ? 'administrable' : 'solo lectura'}
      {isArchived ? ' · archivada' : ''}
    </section>
  )
}));
vi.mock('./property-owner-section', () => ({
  PropertyOwnerSection: ({
    canManageOwners,
    isArchived
  }: {
    canManageOwners: boolean;
    isArchived: boolean;
  }) => (
    <section>
      {canManageOwners && !isArchived ? 'Administrar propietarios' : 'Propietario visible'}
    </section>
  )
}));
vi.mock('./property-agents-section', () => ({
  PropertyAgentsSection: ({
    canManageAgents,
    isArchived
  }: {
    canManageAgents: boolean;
    isArchived: boolean;
  }) => (
    <section>{canManageAgents && !isArchived ? 'Administrar agentes' : 'Agentes visibles'}</section>
  )
}));
vi.mock('./property-movement-history', () => ({
  PropertyMovementHistory: () => <section>Historial reciente</section>
}));
vi.mock('./property-document-requests', () => ({
  PropertyDocumentRequests: () => <section>Solicitudes de documentos</section>
}));
vi.mock('@/features/status-change-requests/components/pending-request-card', () => ({
  PendingRequestCard: () => <section>Solicitud pendiente para revisar</section>
}));
vi.mock('@/features/status-change-requests/components/request-status-change-dialog', () => ({
  RequestStatusChangeDialog: () => <section>Solicitar cambio de estado</section>
}));
vi.mock('./property-image-dialogs', () => ({
  DeletePropertyImageDialog: () => null,
  PropertyImagePreviewDialog: () => null
}));

const product: Product = {
  agents: [],
  archivedAt: null,
  archivedByUserId: null,
  archiveReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  currency: 'ARS',
  id: 'property-1',
  operationType: 'SALE',
  property: {
    addressLine: 'Av. Siempre Viva 742',
    ageYears: null,
    bathrooms: null,
    bedrooms: null,
    city: 'Springfield',
    coveredAreaSqm: null,
    garages: null,
    id: 'home-1',
    images: [],
    orientation: null,
    ownerEmail: null,
    ownerName: null,
    owners: [],
    primaryImage: null,
    propertyType: 'HOUSE',
    province: 'Buenos Aires',
    rooms: null,
    title: 'Casa demo',
    totalAreaSqm: null
  },
  publishedPriceCents: null,
  status: 'CAPTURE',
  tenantId: 'tenant-1',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

afterEach(() => {
  state.manager = true;
  state.pending = false;
  state.routerPush.mockClear();
});

describe('property detail group navigation', () => {
  it('links to unique visible matching destinations containing each group', () => {
    render(<ProductForm initialData={product} pageTitle='Detalle de propiedad' />);
    const links = ['Datos e imágenes', 'Personas', 'Actividad', 'Documentos'].map((name) =>
      screen.getByRole('link', { name })
    );
    const targets = links.map((link) => {
      const id = link.getAttribute('href')?.slice(1);
      expect(id).toBeTruthy();
      const matches = document.querySelectorAll(`[id="${id}"]`);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toBeVisible();
      return matches[0] as HTMLElement;
    });
    expect(new Set(links.map((link) => link.getAttribute('href'))).size).toBe(4);
    expect(targets[0].querySelectorAll('[aria-label="Datos de la propiedad"]')).toHaveLength(1);
    expect(targets[0].querySelector('[aria-label="Datos de la propiedad"]')).not.toHaveClass(
      'hidden'
    );
    expect(screen.getAllByText('Av. Siempre Viva 742')).toHaveLength(1);
    expect(within(targets[0]).getByText('Av. Siempre Viva 742')).toBeVisible();
    expect(within(targets[1]).getByText('Administrar propietarios')).toBeVisible();
    expect(within(targets[2]).getByText(/Estado comercial/)).toBeVisible();
    expect(within(targets[2]).getByText('Historial reciente')).toBeVisible();
    expect(within(targets[3]).getByText('Solicitudes de documentos')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Editar propiedad' })).toBeVisible();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it.each([
    {
      role: 'manager',
      manager: true,
      archived: false,
      pending: true,
      expectedPeople: 'Administrar propietarios',
      expectedAgents: 'Administrar agentes',
      expectedActivity: 'Solicitud pendiente para revisar',
      expectedEdit: true
    },
    {
      role: 'seller',
      manager: false,
      archived: false,
      pending: false,
      expectedPeople: 'Propietario visible',
      expectedAgents: 'Agentes visibles',
      expectedActivity: 'Solicitar cambio de estado',
      expectedEdit: false
    },
    {
      role: 'archived manager',
      manager: true,
      archived: true,
      pending: true,
      expectedPeople: 'Propietario visible',
      expectedAgents: 'Agentes visibles',
      expectedActivity: 'Historial reciente',
      expectedEdit: true
    }
  ])(
    'preserves $role affordances inside the groups',
    async ({
      manager,
      archived,
      pending,
      expectedPeople,
      expectedAgents,
      expectedActivity,
      expectedEdit
    }) => {
      state.manager = manager;
      state.pending = pending;
      const engagement = archived
        ? { ...product, archivedAt: '2026-01-02T00:00:00.000Z' }
        : product;
      render(<ProductForm initialData={engagement} pageTitle='Detalle de propiedad' />);

      const people = document.getElementById('property-people')!;
      const activity = document.getElementById('property-activity')!;
      expect(within(people).getByText(expectedPeople)).toBeVisible();
      expect(within(people).getByText(expectedAgents)).toBeVisible();
      expect(within(activity).getByText(expectedActivity)).toBeVisible();
      expect(within(activity).getByText(/Estado comercial/)).toBeVisible();
      expect(within(activity).getByText('Historial reciente')).toBeVisible();
      if (!archived && manager && pending) {
        expect(within(activity).getByText('Solicitud pendiente para revisar')).toBeVisible();
      } else {
        expect(
          within(activity).queryByText('Solicitud pendiente para revisar')
        ).not.toBeInTheDocument();
      }
      if (expectedEdit) {
        await userEvent.setup().click(screen.getByRole('button', { name: 'Editar propiedad' }));
        expect(state.routerPush).toHaveBeenCalledWith('/dashboard/product/property-1/edit');
      } else {
        expect(screen.queryByRole('button', { name: 'Editar propiedad' })).not.toBeInTheDocument();
      }
    }
  );
});
