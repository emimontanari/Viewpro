import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { productKeys } from '../api/queries';
import type { AssignableProductAgent, PropertyAssignedAgent } from '../api/types';
import { PropertyAgentsSection } from './property-agents-section';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() }
}));

const assignedAgent: PropertyAssignedAgent = {
  email: 'assigned@example.com',
  firstName: 'Ana',
  id: 'agent-assignment-1',
  isPrimary: false,
  userId: 'user-assigned-1'
};

const primaryAssignedAgent: PropertyAssignedAgent = {
  ...assignedAgent,
  isPrimary: true
};

const availableAgent: AssignableProductAgent = {
  email: 'available@example.com',
  firstName: 'Bruno',
  role: 'AGENT',
  userId: 'user-available-1'
};

const secondAvailableAgent: AssignableProductAgent = {
  email: 'second@example.com',
  firstName: 'Carla',
  role: 'MANAGER',
  userId: 'user-available-2'
};

describe('PropertyAgentsSection', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders assigned seller summary before the manage action and opens the dialog', async () => {
    const user = userEvent.setup();
    const fetchMock = mockAssignableAgentsResponse([availableAgent]);
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection({ agents: [assignedAgent] });

    expect(screen.getByText('1 vendedor asignado')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    const agentButton = screen.getByRole('button', { name: 'Ver detalle de Ana' });
    const manageButton = screen.getByRole('button', { name: /gestionar vendedores/i });
    expect(agentButton.compareDocumentPosition(manageButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );

    await user.click(manageButton);

    expect(
      await screen.findByRole('dialog', { name: /gestionar vendedores/i })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products/assignable-agents',
      expect.objectContaining({ cache: 'no-store', credentials: 'include' })
    );
    expect(await screen.findByText('Bruno')).toBeInTheDocument();
  });

  it('does not open or load assignable agents when archived', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection({ agents: [primaryAssignedAgent], isArchived: true });

    expect(screen.getByText('1 vendedor asignado')).toBeInTheDocument();
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /gestionar vendedores/i })).not.toBeInTheDocument();
    expect(
      screen.getByText('Restaurá la propiedad para gestionar vendedores.')
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides management controls when seller management is not permitted', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection({ agents: [primaryAssignedAgent], canManageAgents: false });

    expect(screen.getByText('1 vendedor asignado')).toBeInTheDocument();
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /gestionar vendedores/i })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders the persisted primary badge in the section and dialog', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', mockAssignableAgentsResponse([availableAgent]));
    renderPropertyAgentsSection({ agents: [primaryAssignedAgent] });

    expect(screen.getByText('Principal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));

    expect(await screen.findAllByText('Principal')).toHaveLength(2);
    expect(screen.getByText('Este vendedor principal ya no está disponible.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /marcar como principal/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quitar principal/i })).toBeInTheDocument();
  });

  it('renders the intentional no-primary state without selecting an assigned seller', () => {
    renderPropertyAgentsSection({ agents: [assignedAgent] });

    expect(screen.getByText('Sin vendedor principal')).toBeInTheDocument();
    expect(screen.queryByText('Principal')).not.toBeInTheDocument();
  });

  it('keeps a persisted ineligible primary visible with safe support copy after members load', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      mockAssignableAgentsResponse([
        { ...availableAgent, userId: primaryAssignedAgent.userId, role: 'MANAGER' }
      ])
    );
    renderPropertyAgentsSection({ agents: [primaryAssignedAgent] });

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));

    expect(
      await screen.findByText('Este vendedor principal ya no está disponible.')
    ).toBeInTheDocument();
    expect(screen.getByText('Verificá los integrantes antes de cambiarlo.')).toBeInTheDocument();
    expect(screen.getAllByText('Principal')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: /marcar como principal/i })
    ).not.toBeInTheDocument();
  });

  it('assigns one available agent through the BFF', async () => {
    const user = userEvent.setup();
    const fetchMock = mockProductAgentsFetch([availableAgent]);
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection();

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    await screen.findByText('Bruno');
    await user.click(screen.getByRole('button', { name: /asignar/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/agents',
        expect.objectContaining({
          body: JSON.stringify({ agentUserId: availableAgent.userId }),
          method: 'POST'
        })
      );
    });
  });

  it('removes a primary assignment through DELETE without clearing or promoting another seller', async () => {
    const user = userEvent.setup();
    const alternateAgent = {
      ...assignedAgent,
      id: 'agent-assignment-2',
      userId: 'user-assigned-2'
    };
    const fetchMock = mockProductAgentsFetch([]);
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection({ agents: [primaryAssignedAgent, alternateAgent] });

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    await screen.findByRole('dialog', { name: /gestionar vendedores/i });
    fetchMock.mockClear();
    await user.click(screen.getAllByRole('button', { name: /^quitar/i })[1]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/products/product-1/agents/${primaryAssignedAgent.id}`,
        expect.objectContaining({ method: 'DELETE' })
      )
    );
    expect(fetchMock.mock.calls.some(([path]) => path.includes('/agents/primary'))).toBe(false);
  });

  it('assigns all available agents through the BFF', async () => {
    const user = userEvent.setup();
    const fetchMock = mockProductAgentsFetch([availableAgent, secondAvailableAgent]);
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection();

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    await user.click(await screen.findByRole('button', { name: /sumar 2 vendedores/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/agents',
        expect.objectContaining({
          body: JSON.stringify({ agentUserId: availableAgent.userId }),
          method: 'POST'
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/agents',
        expect.objectContaining({
          body: JSON.stringify({ agentUserId: secondAvailableAgent.userId }),
          method: 'POST'
        })
      );
    });
  });

  it('offers primary actions only after a loaded assigned member has the exact AGENT role', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      mockAssignableAgentsResponse([{ ...availableAgent, userId: assignedAgent.userId }])
    );
    renderPropertyAgentsSection({ agents: [assignedAgent] });
    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));

    expect(await screen.findByRole('button', { name: /marcar como principal/i })).toBeInTheDocument();
  });

  it('keeps primary actions absent after loaded non-AGENT members mark the persisted primary unavailable', async () => {
    const user = userEvent.setup();
    const alternateAgent = {
      ...assignedAgent,
      id: 'agent-assignment-2',
      userId: 'user-assigned-2'
    };
    vi.stubGlobal(
      'fetch',
      mockAssignableAgentsResponse([
        { ...availableAgent, userId: primaryAssignedAgent.userId, role: 'MANAGER' },
        { ...availableAgent, userId: alternateAgent.userId, role: 'MANAGER' }
      ])
    );
    renderPropertyAgentsSection({ agents: [primaryAssignedAgent, alternateAgent] });
    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));

    expect(await screen.findByText('Este vendedor principal ya no está disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /marcar como principal/i })).toBeNull();
  });

  it('keeps primary actions absent after the assignable-members error is rendered', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('load failed')));
    renderPropertyAgentsSection({ agents: [assignedAgent] });
    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));

    expect(await screen.findByText('No se pudieron cargar los vendedores disponibles.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /marcar como principal/i })).toBeNull();
  });

  it('keeps primary actions absent while assignable members are pending', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    renderPropertyAgentsSection({ agents: [assignedAgent] });
    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));

    expect(await screen.findByLabelText('Cargando vendedores disponibles')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /marcar como principal/i })).toBeNull();
  });

  it('does not paint a primary badge before a deferred set response replaces the cache', async () => {
    const user = userEvent.setup();
    const response = { id: 'product-1', agents: [{ ...assignedAgent, isPrimary: true }] };
    let resolvePrimary!: () => void;
    const primaryResponse = new Promise<Response>((resolve) => {
      resolvePrimary = () => resolve(jsonResponse(response));
    });
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/products/assignable-agents') {
        return Promise.resolve(
          jsonResponse({ items: [{ ...availableAgent, userId: assignedAgent.userId }] })
        );
      }
      if (path.endsWith('/agents/primary')) return primaryResponse;
      return Promise.resolve(jsonResponse({}, { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { queryClient } = renderPropertyAgentsSection({ agents: [assignedAgent] });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    await user.click(await screen.findByRole('button', { name: /marcar como principal/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/agents/primary',
        expect.objectContaining({
          body: JSON.stringify({ agentId: assignedAgent.id, expectedPrimaryAgentId: null }),
          method: 'PUT'
        })
      )
    );
    expect(screen.queryByText('Principal')).toBeNull();
    expect(queryClient.getQueryData(productKeys.detail('product-1', 'tenant-1'))).toBeUndefined();

    resolvePrimary();

    await waitFor(() => {
      expect(queryClient.getQueryData(productKeys.detail('product-1', 'tenant-1'))).toEqual(
        response
      );
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: productKeys.all });
    });
  });

  it('sends the current primary as the compare-and-set value when changing to an eligible seller', async () => {
    const user = userEvent.setup();
    const candidate = { ...assignedAgent, id: 'agent-assignment-2', userId: 'user-assigned-2' };
    const fetchMock = vi.fn((path: string) => {
      if (path === '/api/products/assignable-agents') {
        return Promise.resolve(
          jsonResponse({
            items: [
              { ...availableAgent, userId: primaryAssignedAgent.userId },
              { ...availableAgent, userId: candidate.userId }
            ]
          })
        );
      }
      if (path.endsWith('/agents/primary'))
        return Promise.resolve(jsonResponse({ id: 'product-1' }));
      return Promise.resolve(jsonResponse({}, { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection({ agents: [primaryAssignedAgent, candidate] });

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    await user.click(await screen.findByRole('button', { name: /marcar como principal/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/agents/primary',
        expect.objectContaining({
          body: JSON.stringify({
            agentId: candidate.id,
            expectedPrimaryAgentId: primaryAssignedAgent.id
          }),
          method: 'PUT'
        })
      )
    );
  });

  it('keeps clear separate from removal', async () => {
    const user = userEvent.setup();
    const fetchMock = mockProductAgentsFetch([{ ...availableAgent, userId: assignedAgent.userId }]);
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection({ agents: [primaryAssignedAgent] });
    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    await user.click(await screen.findByRole('button', { name: /quitar principal/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/agents/primary/clear',
        expect.objectContaining({
          body: JSON.stringify({ expectedPrimaryAgentId: primaryAssignedAgent.id }),
          method: 'POST'
        })
      )
    );
  });

  it.each([
    { action: 'Marcar como principal', agents: [assignedAgent], isArchived: true },
    { action: 'Quitar principal', agents: [primaryAssignedAgent], isArchived: true },
    { action: 'Marcar como principal', agents: [assignedAgent], canManageAgents: false },
    { action: 'Quitar principal', agents: [primaryAssignedAgent], canManageAgents: false }
  ])('blocks primary $action when dialog props revoke management access', async (scenario) => {
    const user = userEvent.setup();
    const fetchMock = mockAssignableAgentsResponse([
      { ...availableAgent, userId: scenario.agents[0].userId }
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = renderPropertyAgentsSection({ agents: scenario.agents });

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    await screen.findByRole('dialog', { name: /gestionar vendedores/i });
    rerender(
      <PropertyAgentsSection
        agents={scenario.agents}
        canManageAgents={scenario.canManageAgents ?? true}
        isArchived={scenario.isArchived ?? false}
        productId='product-1'
        tenantId='tenant-1'
      />
    );
    await user.click(screen.getByRole('button', { name: scenario.action }));

    expect(fetchMock.mock.calls.some(([path]) => path.includes('/agents/primary'))).toBe(false);
  });

  it('disables every seller action and keeps the current primary painted while a change is pending', async () => {
    const user = userEvent.setup();
    const alternateAgent = {
      ...assignedAgent,
      id: 'agent-assignment-2',
      userId: 'user-assigned-2'
    };
    const secondAlternateAgent = {
      ...assignedAgent,
      id: 'agent-assignment-3',
      userId: 'user-assigned-3'
    };
    const members = [
      { ...availableAgent, userId: primaryAssignedAgent.userId },
      { ...availableAgent, userId: alternateAgent.userId },
      { ...availableAgent, userId: secondAlternateAgent.userId },
      availableAgent
    ];
    const fetchMock = vi.fn((path: string) =>
      path === '/api/products/assignable-agents'
        ? Promise.resolve(jsonResponse({ items: members }))
        : new Promise(() => undefined)
    );
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection({
      agents: [primaryAssignedAgent, alternateAgent, secondAlternateAgent]
    });
    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    const setButtons = await screen.findAllByRole('button', { name: /marcar como principal/i });
    const assignButton = screen.getByRole('button', { name: /asignar/i });
    const assignAllButton = screen.getByRole('button', { name: /sumar 1 vendedor/i });
    await user.click(setButtons[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/agents/primary',
        expect.objectContaining({ method: 'PUT' })
      );
      const removeButtons = screen
        .getAllByRole('button', { name: /quitar/i })
        .filter((button) => button.textContent === 'Quitar');
      expect(removeButtons).toHaveLength(3);
      removeButtons.forEach((button) => expect(button).toBeDisabled());
      expect(screen.getByRole('button', { name: /quitar principal/i })).toBeDisabled();
      expect(screen.getAllByRole('button', { name: /marcar como principal/i })).toHaveLength(2);
      screen
        .getAllByRole('button', { name: /marcar como principal/i })
        .forEach((button) => expect(button).toBeDisabled());
      expect(assignButton).toBeDisabled();
      expect(assignAllButton).toBeDisabled();
      expect(screen.getAllByText('Principal')).toHaveLength(2);
    });
  });

  it.each([
    [
      'PRIMARY_AGENT_STATE_CONFLICT',
      'La selección principal cambió. Actualizá la propiedad e intentá de nuevo.'
    ],
    [
      'PRIMARY_AGENT_CANDIDATE_INVALID',
      'El vendedor ya no puede ser principal para esta propiedad.'
    ]
  ] as const)(
    'forces an exact durable detail request before safe feedback for fresh-cache %s',
    async (errorCode, message) => {
      const user = userEvent.setup();
      const staleDetail = { id: 'product-1', agents: [assignedAgent] };
      const durableDetail = { id: 'product-1', agents: [] };
      let resolveDetail!: () => void;
      const detail = new Promise<Response>((resolve) => {
        resolveDetail = () => resolve(jsonResponse(durableDetail));
      });
      const fetchMock = vi.fn((path: string) => {
        if (path === '/api/products/assignable-agents')
          return Promise.resolve(
            jsonResponse({ items: [{ ...availableAgent, userId: assignedAgent.userId }] })
          );
        if (path.endsWith('/agents/primary'))
          return Promise.resolve(
            jsonResponse({ errorCode }, { status: errorCode.includes('CONFLICT') ? 409 : 400 })
          );
        if (path === '/api/products/product-1') return detail;
        return Promise.resolve(jsonResponse({}, { status: 404 }));
      });
      vi.stubGlobal('fetch', fetchMock);
      const { queryClient } = renderPropertyAgentsSection({
        agents: [assignedAgent],
        queryStaleTime: 60_000
      });
      queryClient.setQueryData(productKeys.detail('product-1', 'tenant-1'), staleDetail);
      await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
      await user.click(await screen.findByRole('button', { name: /marcar como principal/i }));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith('/api/products/product-1', expect.anything())
      );
      expect(queryClient.getQueryData(productKeys.detail('product-1', 'tenant-1'))).toEqual(staleDetail);
      expect(toast.error).not.toHaveBeenCalled();
      resolveDetail();
      await waitFor(() => {
        expect(queryClient.getQueryData(productKeys.detail('product-1', 'tenant-1'))).toEqual(
          durableDetail
        );
        expect(toast.error).toHaveBeenCalledWith(message);
      });
    }
  );

  it('preserves server state and uses fallback copy for generic primary failures', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((path: string) =>
      path === '/api/products/assignable-agents'
        ? Promise.resolve(
            jsonResponse({ items: [{ ...availableAgent, userId: assignedAgent.userId }] })
          )
        : Promise.resolve(jsonResponse({}, { status: 500 }))
    );
    vi.stubGlobal('fetch', fetchMock);
    const { queryClient } = renderPropertyAgentsSection({ agents: [assignedAgent] });
    const cached = { id: 'product-1', agents: [assignedAgent] };
    queryClient.setQueryData(productKeys.detail('product-1', 'tenant-1'), cached);
    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    await user.click(await screen.findByRole('button', { name: /marcar como principal/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('No se pudo actualizar el vendedor principal.')
    );
    expect(queryClient.getQueryData(productKeys.detail('product-1', 'tenant-1'))).toBe(cached);
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/products/product-1')).toBe(false);
  });
});

function renderPropertyAgentsSection({
  agents = [],
  canManageAgents = true,
  isArchived = false,
  tenantId = 'tenant-1',
  queryStaleTime = 0
}: {
  agents?: PropertyAssignedAgent[];
  canManageAgents?: boolean;
  isArchived?: boolean;
  tenantId?: string | null;
  queryStaleTime?: number;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: queryStaleTime }
    }
  });

  const result = render(
    <PropertyAgentsSection
      agents={agents}
      canManageAgents={canManageAgents}
      isArchived={isArchived}
      productId='product-1'
      tenantId={tenantId}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )
    }
  );
  return { ...result, queryClient };
}

function mockAssignableAgentsResponse(items: AssignableProductAgent[]) {
  return vi.fn().mockResolvedValue(jsonResponse({ items }));
}

function mockProductAgentsFetch(assignableAgents: AssignableProductAgent[]) {
  return vi.fn((path: string, init?: RequestInit) => {
    if (path === '/api/products/assignable-agents') {
      return Promise.resolve(jsonResponse({ items: assignableAgents }));
    }

    if (path === `/api/products/product-1/agents/${assignedAgent.id}`) {
      return Promise.resolve(jsonResponse({ deleted: true, id: assignedAgent.id }));
    }

    if (path === '/api/products/product-1/agents/primary/clear') {
      return Promise.resolve(jsonResponse({ id: 'product-1', agents: [] }));
    }

    if (path === '/api/products/product-1/agents' && init?.method === 'POST') {
      return Promise.resolve(jsonResponse({ id: 'agent-assignment' }, { status: 201 }));
    }

    return Promise.resolve(jsonResponse({}, { status: 404 }));
  });
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: init.status ?? 200,
    ...init
  });
}
