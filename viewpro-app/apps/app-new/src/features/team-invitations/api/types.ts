import type { Session } from '@/lib/session';

export type TeamInvitationRole = 'MANAGER' | 'AGENT';

export type TeamInvitationResponse = {
  email: string;
  role: TeamInvitationRole;
  status: 'PENDING';
  expiresAt: string;
  emailRegistered: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
};

export type AcceptTeamInvitationInput =
  | { mode: 'register'; firstName: string; lastName?: string; password: string }
  | { mode: 'login'; password: string }
  | { mode: 'current-session' };

export type TeamInvitationSession = Session;
