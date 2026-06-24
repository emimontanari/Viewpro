/**
 * App-local brand constants for the FE (apps/app-new).
 * Phase 1: extraction only — all values read "ViewPro".
 * Phase 2: flip values to "InmoView" by editing this file alone.
 *
 * No use-client / use-server directive — importable by Server Components,
 * Client Components, and static pages alike.
 */
export const BRAND = {
  /** Core identity */
  identity: {
    productName: 'ViewPro',
    legalEntity: 'ViewPro',
    /** Spanish prose phrase: "...con el {teamPhraseEs}." → "equipo de ViewPro" */
    teamPhraseEs: 'equipo de ViewPro',
    /** English prose phrase: "contact the {teamPhraseEn} through..." → "ViewPro team" */
    teamPhraseEn: 'ViewPro team'
  },

  /** Page/document titles */
  metadata: {
    appTitle: 'ViewPro',
    dashboardTitle: 'ViewPro Dashboard',
    adminTitle: 'Admin ViewPro',
    defaultDescription: 'Panel de ViewPro para inmobiliarias'
  },

  /** Auth page copy */
  auth: {
    /** Sign-in brand label (top-left logo area) */
    signInLabel: 'ViewPro',
    /** Sign-up brand label (top-left logo area) */
    signUpLabel: 'ViewPro',
    /** Brand label on invitation acceptance pages (owner & team) */
    invitationLabel: 'ViewPro',
    /** Testimonial quote body used on sign-in and sign-up panels
     * (raw text — JSX callers wrap with &ldquo; / &rdquo;) */
    testimonialQuote:
      'ViewPro nos ayuda a ordenar propiedades, contactos y seguimiento comercial en un solo lugar.',
    /** Testimonial author footer — shared across auth and invitation panels */
    testimonialAuthor: 'Equipo ViewPro',
    /** Sign-in page footer copy */
    signInContinue: 'Ingresá para continuar con ViewPro.',
    /** Sign-up page footer copy */
    signUpContinue: 'Creá tu cuenta para continuar con ViewPro.',
    /** Sign-up subtitle */
    signUpSubtitle: 'Completá tus datos para crear tu cuenta y empezar a usar ViewPro.',
    /** Generic connectivity-error description shown on invitation pages */
    invitationConnectError: 'No pudimos conectar con ViewPro. Volvé a intentarlo más tarde.',
    /** Already-accepted invitation error (team invitation) */
    teamInvitationAlreadyAccepted:
      'Esta invitación ya fue aceptada. Iniciá sesión para acceder a ViewPro.',
    /** Already-registered email error on owner invitation */
    ownerInvitationEmailRegistered:
      'Este email ya está registrado. Iniciá sesión para continuar con ViewPro.'
  },

  /** SEO / Open-Graph */
  seo: {
    ogSiteName: 'ViewPro'
  },

  /**
   * PWA manifest fields — defined for Phase 2 readiness.
   * No manifest.ts/webmanifest exists in Phase 1; wire these in Phase 2.
   */
  pwa: {
    name: 'ViewPro',
    shortName: 'ViewPro',
    description: 'Panel de ViewPro para inmobiliarias'
  },

  /** Admin console copy */
  admin: {
    /** Restricted-access card heading shown to non-admin users */
    restrictedTitle: 'Acceso restringido a ViewPro Admin'
  },

  /** Invitation page metadata */
  invitations: {
    ownerTitle: 'Aceptar invitación | ViewPro',
    ownerDescription:
      'Aceptá tu invitación para acceder al portal de propietarios de ViewPro.',
    teamTitle: 'Aceptar invitación de equipo | ViewPro',
    teamDescription: 'Aceptá tu invitación para sumarte a una inmobiliaria en ViewPro.'
  },

  /** Owner portal sidebar tagline */
  ownerPortalTagline: 'ViewPro',

  /** Dashboard empty-state copy */
  dashboardEmptyDescription:
    'Creá una propiedad para empezar a operar la gestión desde ViewPro.'
} as const
