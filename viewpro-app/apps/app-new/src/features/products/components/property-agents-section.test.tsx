import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssignableProductAgent, ProductAgent } from '../api/types';
import { PropertyAgentsSection } from './property-agents-section';

const assignedAgent: ProductAgent = {
  email: 'assigned@example.com',
  firstName: 'Ana',
  id: 'agent-assignment-1',
  userId: 'user-assigned-1'
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
    renderPropertyAgentsSection({ isArchived: true });

    expect(screen.getByText('0 vendedores asignados')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /gestionar vendedores/i })).not.toBeInTheDocument();
    expect(
      screen.getByText('Restaurá la propiedad para gestionar vendedores.')
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('removes an assigned agent through the BFF', async () => {
    const user = userEvent.setup();
    const fetchMock = mockProductAgentsFetch([]);
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyAgentsSection({ agents: [assignedAgent] });

    await user.click(screen.getByRole('button', { name: /gestionar vendedores/i }));
    await screen.findByRole('dialog', { name: /gestionar vendedores/i });
    await user.click(screen.getByRole('button', { name: /quitar/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/products/product-1/agents/${assignedAgent.id}`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
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
});

function renderPropertyAgentsSection({
  agents = [],
  isArchived = false,
  tenantId = 'tenant-1'
}: {
  agents?: ProductAgent[];
  isArchived?: boolean;
  tenantId?: string | null;
} = {}) {
  return render(
    <PropertyAgentsSection
      agents={agents}
      isArchived={isArchived}
      productId='product-1'
      tenantId={tenantId}
    />,
    { wrapper: createQueryClientWrapper() }
  );
}

function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  return function QueryClientWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
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
