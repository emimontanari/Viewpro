import { Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ClsService } from "nestjs-cls";
import { TENANT_ID_CLS_KEY } from "../tenant-context/tenant-context.store";

const logger = new Logger("TenantIsolation");

/**
 * Models with a direct `tenantId` column (class A). A query on one of these
 * from a tenant-scoped request MUST filter by tenantId; a missing filter is a
 * potential cross-tenant leak. Kept in sync with prisma/schema.prisma.
 *
 * NOT class A (excluded on purpose):
 *  - Tenant (keyed by `id`, not `tenantId`).
 *  - PropertyAsset/PropertyAssetOwner/OwnerInvitation/PropertyAssetImage,
 *    Document/DocumentVersion — no direct tenantId, scoped relationally (class B).
 *  - User/RefreshToken/PasswordResetToken/EmailVerificationToken — tenant-agnostic.
 */
const TENANT_OWNED_MODELS: ReadonlySet<string> = new Set([
	"TenantMembership",
	"TeamInvitation",
	"TenantMovementOutcomeLabel",
	"PropertyEngagement",
	"PropertyAgent",
	"Movement",
	"DocumentRequest",
	"Notification",
	"AnalyticsEvent",
	"PlatformCommandLog",
	"PlatformOutboxEvent",
	"StatusChangeRequest",
]);

/**
 * Read/aggregate/bulk ops whose `where` accepts a `tenantId` filter. For these
 * the extension INJECTS `where.tenantId` from the ALS when absent (enforce).
 */
const WHERE_INJECTABLE_OPERATIONS: ReadonlySet<string> = new Set([
	"findFirst",
	"findFirstOrThrow",
	"findMany",
	"count",
	"aggregate",
	"groupBy",
	"updateMany",
	"deleteMany",
]);

/**
 * Ops keyed by a unique field (findUnique/update/delete/upsert). Prisma rejects
 * a non-unique `tenantId` in their `where`, so these still only WARN here and
 * will be enforced by post-fetch validation in a follow-up (Phase 3b).
 */
const WARN_ONLY_OPERATIONS: ReadonlySet<string> = new Set([
	"findUnique",
	"findUniqueOrThrow",
	"update",
	"delete",
	"upsert",
]);

/**
 * Isolation backstop — Phase 3a (ENFORCE reads/bulk + WARN by-id). A Prisma
 * client extension that, for class-A models queried FROM A TENANT-SCOPED
 * REQUEST:
 *  - injects `where.tenantId` (from the ALS) into where-injectable operations
 *    when absent, so a forgotten filter can no longer read or bulk-touch
 *    another tenant's rows;
 *  - still only warns on unique-keyed operations (findUnique/update/delete/
 *    upsert), which need post-fetch validation (added in a follow-up).
 *
 * Bypass paths (owner portal, platform control lane, admin, auth/register,
 * seed) never populate the tenant ALS, so `tenantId` is undefined for them and
 * enforcement/warnings are skipped — no manual allow-list needed.
 */
export function createTenantIsolationExtension(cls: ClsService) {
	return Prisma.defineExtension({
		name: "tenant-isolation",
		query: {
			$allModels: {
				async $allOperations({ model, operation, args, query }) {
					const tenantId = cls.isActive()
						? cls.get<string | undefined>(TENANT_ID_CLS_KEY)
						: undefined;

					if (tenantId === undefined || !TENANT_OWNED_MODELS.has(model)) {
						return query(args);
					}

					if (WHERE_INJECTABLE_OPERATIONS.has(operation)) {
						return query(injectTenantId(args, tenantId));
					}

					if (WARN_ONLY_OPERATIONS.has(operation) && !hasTenantIdInArgs(args)) {
						logger.warn(
							`Query on tenant-owned ${model}.${operation} without a tenantId filter (tenant=${tenantId})`,
						);
					}

					return query(args);
				},
			},
		},
	});
}

/**
 * Merge `where.tenantId` into the args when not already present. An explicit
 * tenantId set by the repository is respected (never overwritten).
 */
export function injectTenantId<T>(args: T, tenantId: string): T {
	const base =
		args && typeof args === "object" ? (args as Record<string, unknown>) : {};
	const where =
		base.where && typeof base.where === "object"
			? (base.where as Record<string, unknown>)
			: {};

	if ("tenantId" in where) {
		return args;
	}

	return { ...base, where: { ...where, tenantId } } as T;
}

export function hasTenantIdInArgs(args: unknown): boolean {
	if (!args || typeof args !== "object") {
		return false;
	}

	const where = (args as { where?: Record<string, unknown> }).where;
	if (where && typeof where === "object" && "tenantId" in where) {
		return true;
	}

	const data = (args as { data?: Record<string, unknown> }).data;
	if (data && typeof data === "object" && "tenantId" in data) {
		return true;
	}

	return false;
}
