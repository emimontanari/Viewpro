'use client';

import type { AuditLogItem } from '@/features/audit/api/types';
import { actorPrimary, sourceLabel } from './audit-identity';
import { actionLabel, formatFullTimestamp, renderValue } from './render-value';
import styles from './audit.module.css';

type DetailField = { label: string; value: string };

// Native OPERATOR_CREATED/SUSPENDED/REACTIVATED carry no old→new delta (both
// null); OPERATOR_ROLE_CHANGED does. Mirrors AuditTable's own predicate —
// small enough that sharing it is not worth the coupling (D12 tradeoff).
function hasValueDelta(item: AuditLogItem): boolean {
  return item.previousValue != null || item.newValue != null;
}

/**
 * audit-view (Slice 3, Phase 3) — type-specific target fields (spec:
 * "Drill-down forensic detail"). TENANT_DOCUMENT_VIEWED's target carries
 * {documentVersionId, filename} (tenant-detail.service.ts getDocumentReadUrl
 * → auditLogRepository.appendNative); every other action's target carries
 * {id, email} for the affected operator. Absent/malformed target degrades to
 * an empty field list rather than throwing.
 */
function targetFields(item: AuditLogItem): DetailField[] {
  if (!item.target) {
    return [];
  }

  if (item.action === 'TENANT_DOCUMENT_VIEWED') {
    const fields: DetailField[] = [];
    if (item.target.documentVersionId) {
      fields.push({ label: 'Documento (versión)', value: item.target.documentVersionId });
    }
    if (item.target.filename) {
      fields.push({ label: 'Archivo', value: item.target.filename });
    }
    return fields;
  }

  if (item.target.email || item.target.id) {
    return [{ label: 'Operador afectado', value: item.target.email ?? item.target.id ?? '—' }];
  }

  return [];
}

function buildAuditRowDetail(item: AuditLogItem): DetailField[] {
  const fields: DetailField[] = [
    { label: 'Actor', value: actorPrimary(item) },
    { label: 'ID de actor', value: item.actor.id },
    { label: 'Inmobiliaria', value: item.tenantName ?? item.tenantId ?? '—' },
    { label: 'ID de inmobiliaria', value: item.tenantId ?? '—' },
    { label: 'Acción', value: actionLabel(item.action) },
    ...targetFields(item)
  ];

  // Scenario: expand a native row with no delta — the before→after arrow is
  // omitted entirely (not shown as "—"), mirroring AuditTable's existing
  // hasValueDelta behavior for the compact "Cambio" column.
  if (hasValueDelta(item)) {
    fields.push({ label: 'Antes', value: renderValue(item.previousValue) });
    fields.push({ label: 'Después', value: renderValue(item.newValue) });
  }

  fields.push({ label: 'Fecha y hora', value: formatFullTimestamp(item.occurredAt) });
  fields.push({ label: 'Origen', value: sourceLabel(item.source) });
  // Scenario: native rows carry no outbox sequence — shown as "—", never a
  // stray "null"/"undefined" string.
  fields.push({
    label: 'Secuencia',
    value: item.seqNo === null || item.seqNo === undefined ? '—' : String(item.seqNo)
  });

  return fields;
}

type Props = {
  item: AuditLogItem;
};

/**
 * Full forensic drill-down for one audit row (spec: "Drill-down forensic
 * detail"). COPIES (does not extract/share) the <dl>/<dt>/<dd> structural
 * pattern from tenant-activity-feed.tsx:299-332 (design D12) — this feature
 * must not import tenant-specific formatters (buildTenantActivityDetail,
 * readActorFull, etc). Expand/collapse state lives in the caller
 * (AuditTable) — this component always renders its full field list, since
 * AuditTable only mounts it while a row is expanded.
 */
export function AuditRowDetail({ item }: Props) {
  const fields = buildAuditRowDetail(item);

  return (
    <div className={styles.rowDetailInner}>
      <dl data-testid={`audit-detail-${item.id}`} className={styles.detailList}>
        {fields.map((field) => (
          <div key={field.label} className={styles.detailPair}>
            <dt className={styles.detailLabel}>{field.label}</dt>
            <dd className={styles.detailValue}>{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
