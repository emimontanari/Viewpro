/**
 * App-local brand constants for the FE (apps/app-new).
 * Single source of truth for user-visible product brand strings —
 * flipping the product name is an edit to this file alone.
 *
 * No use-client / use-server directive — importable by Server Components,
 * Client Components, and static pages alike.
 */
export const BRAND = {
  /** Core identity */
  identity: {
    productName: 'InmoView',
    legalEntity: 'InmoView',
    /** Spanish prose phrase: "...con el {teamPhraseEs}." → "equipo de InmoView" */
    teamPhraseEs: 'equipo de InmoView',
    /** English prose phrase: "contact the {teamPhraseEn} through..." → "InmoView team" */
    teamPhraseEn: 'InmoView team'
  },

  /** Page/document titles */
  metadata: {
    appTitle: 'InmoView',
    dashboardTitle: 'InmoView Dashboard',
    adminTitle: 'Admin InmoView',
    defaultDescription: 'Panel de InmoView para inmobiliarias'
  },

  /** Auth page copy */
  auth: {
    /** Sign-in brand label (top-left logo area) */
    signInLabel: 'InmoView',
    /** Sign-up brand label (top-left logo area) */
    signUpLabel: 'InmoView',
    /** Brand label on invitation acceptance pages (owner & team) */
    invitationLabel: 'InmoView',
    /** Testimonial quote body used on sign-in and sign-up panels
     * (raw text — JSX callers wrap with &ldquo; / &rdquo;) */
    testimonialQuote:
      'InmoView nos ayuda a ordenar propiedades, contactos y seguimiento comercial en un solo lugar.',
    /** Testimonial author footer — shared across auth and invitation panels */
    testimonialAuthor: 'Equipo InmoView',
    /** Sign-in page footer copy */
    signInContinue: 'Ingresá para continuar con InmoView.',
    /** Sign-up page footer copy */
    signUpContinue: 'Creá tu cuenta para continuar con InmoView.',
    /** Sign-up subtitle */
    signUpSubtitle: 'Completá tus datos para crear tu cuenta y empezar a usar InmoView.',
    /** Generic connectivity-error description shown on invitation pages */
    invitationConnectError: 'No pudimos conectar con InmoView. Volvé a intentarlo más tarde.',
    /** Already-accepted invitation error (team invitation) */
    teamInvitationAlreadyAccepted:
      'Esta invitación ya fue aceptada. Iniciá sesión para acceder a InmoView.',
    /** Already-registered email error on owner invitation */
    ownerInvitationEmailRegistered:
      'Este email ya está registrado. Iniciá sesión para continuar con InmoView.'
  },

  /** SEO / Open-Graph */
  seo: {
    ogSiteName: 'InmoView'
  },

  /**
   * PWA manifest fields — defined for Phase 2b readiness.
   * No manifest.ts/webmanifest exists yet; wire these once brand icon
   * assets exist (deferred PWA slice).
   */
  pwa: {
    name: 'InmoView',
    shortName: 'InmoView',
    description: 'Panel de InmoView para inmobiliarias'
  },

  /** Admin console copy */
  admin: {
    /** Restricted-access card heading shown to non-admin users */
    restrictedTitle: 'Acceso restringido a InmoView Admin'
  },

  /** Invitation page metadata */
  invitations: {
    ownerTitle: 'Aceptar invitación | InmoView',
    ownerDescription:
      'Aceptá tu invitación para acceder al portal de propietarios de InmoView.',
    teamTitle: 'Aceptar invitación de equipo | InmoView',
    teamDescription: 'Aceptá tu invitación para sumarte a una inmobiliaria en InmoView.'
  },

  /** Owner portal sidebar tagline */
  ownerPortalTagline: 'InmoView',

  /** Dashboard empty-state copy */
  dashboardEmptyDescription:
    'Creá una propiedad para empezar a operar la gestión desde InmoView.'
} as const
