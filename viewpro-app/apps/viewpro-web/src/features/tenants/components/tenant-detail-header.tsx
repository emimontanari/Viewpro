import styles from './tenant-detail.module.css';

// Same short-code the breadcrumb shows for a tenant id (first 5 chars) —
// see use-breadcrumbs.tsx BREADCRUMB_ID_PREVIEW_LENGTH.
const CODE_PREVIEW_LENGTH = 5;

function tenantCode(tenantId: string): string {
  return tenantId.slice(0, CODE_PREVIEW_LENGTH);
}

type Props = { tenantId: string };

/**
 * Page header for the tenant detail view (feat/web-tenant-detail-redesign).
 * Presentation-only. TenantDetailResponse carries NO human-readable tenant
 * name, and this header must not add a fetch, so the H1 IS the short code
 * (the same value the breadcrumb derives). No separate code pill is rendered
 * here because it would duplicate the H1; if a name ever becomes available the
 * H1 would show the name and the code would move into the pill.
 */
export function TenantDetailHeader({ tenantId }: Props) {
  const code = tenantCode(tenantId);

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{code}</h1>
      </div>
      <p className={styles.subtitle}>Actividad y métricas de la inmobiliaria seleccionada.</p>
    </header>
  );
}
