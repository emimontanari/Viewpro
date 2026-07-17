import { Icons } from '@/components/icons';
import type { TenantDetailResponse } from '@/features/tenants/api/types';
import styles from './tenant-detail.module.css';

type Props = { summary: TenantDetailResponse };

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-AR').format(value);
}

const EMPTY_PERIOD_LABEL = 'Sin registros en el período';

/**
 * KPI cards for the tenant detail view (feat/web-tenant-detail-redesign).
 * Presentation-only redesign — every value still comes from the SAME `summary`
 * object the initial query returned (the "Documentos" total is summed in-render
 * from the four already-present state counts; no new data is fetched or
 * derived). data-testids are preserved for the container tests.
 */
export function TenantDetailStatCards({ summary }: Props) {
  const documentsTotal =
    summary.documentEvents.requested +
    summary.documentEvents.uploaded +
    summary.documentEvents.approved +
    summary.documentEvents.rejected;

  return (
    <div className={styles.grid}>
      {/* Compromisos activos */}
      <div className={styles.card}>
        <div className={styles.cardTop}>
          <span className={styles.cardLabel}>Compromisos activos</span>
          <Icons.listDetails
            className={styles.cardIcon}
            aria-label='Compromisos activos'
            title='Compromisos activos en el período'
          />
        </div>
        <div className={styles.cardBody}>
          <span data-testid='stat-active-engagements' className={styles.cardValue}>
            {formatNumber(summary.activeEngagements)}
          </span>
          {summary.activeEngagements === 0 && (
            <span className={styles.cardEmpty}>{EMPTY_PERIOD_LABEL}</span>
          )}
        </div>
      </div>

      {/* Con actualización visible */}
      <div className={styles.card}>
        <div className={styles.cardTop}>
          <span className={styles.cardLabel}>Con actualización visible</span>
          <Icons.check
            className={styles.cardIcon}
            aria-label='Con actualización visible'
            title='Compromisos con una actualización visible para el propietario'
          />
        </div>
        <div className={styles.cardBody}>
          <span data-testid='stat-engagements-with-update' className={styles.cardValue}>
            {formatNumber(summary.activeEngagementsWithOwnerVisibleUpdate)}
          </span>
          <span className={styles.cardSub}>({summary.activeEngagementUpdatePercentage}%)</span>
          {summary.activeEngagementsWithOwnerVisibleUpdate === 0 && (
            <span className={styles.cardEmpty}>{EMPTY_PERIOD_LABEL}</span>
          )}
        </div>
      </div>

      {/* Documentos */}
      <div className={styles.card}>
        <div className={styles.cardTop}>
          <span className={styles.cardLabel}>Documentos</span>
          <Icons.page
            className={styles.cardIcon}
            aria-label='Documentos'
            title='Eventos de documentos en el período'
          />
        </div>
        <div className={styles.cardBody}>
          <span data-testid='stat-documents' className={styles.cardValue}>
            {formatNumber(documentsTotal)}
          </span>
          {documentsTotal === 0 && <span className={styles.cardEmpty}>{EMPTY_PERIOD_LABEL}</span>}
          <div className={styles.badgeRow}>
            <span className={styles.badge}>Solicitados {formatNumber(summary.documentEvents.requested)}</span>
            <span className={styles.badge}>Subidos {formatNumber(summary.documentEvents.uploaded)}</span>
            <span className={`${styles.badge} ${styles.badgeApproved}`}>
              Aprobados {formatNumber(summary.documentEvents.approved)}
            </span>
            <span className={`${styles.badge} ${styles.badgeRejected}`}>
              Rechazados {formatNumber(summary.documentEvents.rejected)}
            </span>
          </div>
        </div>
      </div>

      {/* Vistas de propietario */}
      <div className={styles.card}>
        <div className={styles.cardTop}>
          <span className={styles.cardLabel}>Vistas de propietario</span>
          <Icons.info
            className={styles.cardIcon}
            aria-label='Vistas de propietario'
            title='Propiedades vistas por el propietario en el período'
          />
        </div>
        <div className={styles.cardBody}>
          <span data-testid='stat-owner-views' className={styles.cardValue}>
            {formatNumber(summary.ownerViewedPropertyCount)}
          </span>
          {summary.ownerViewedPropertyCount === 0 && (
            <span className={styles.cardEmpty}>{EMPTY_PERIOD_LABEL}</span>
          )}
        </div>
      </div>
    </div>
  );
}
