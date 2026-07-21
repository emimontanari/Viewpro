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

/** Operations that read or mutate existing rows and therefore must be scoped. */
const SCOPED_OPERATIONS: ReadonlySet<string> = new Set([
	"findFirst",
	"findFirstOrThrow",
	"findMany",
	"findUnique",
	"findUniqueOrThrow",
	"count",
	"aggregate",
	"groupBy",
	"update",
	"updateMany",
	"delete",
	"deleteMany",
	"upsert",
]);

/**
 * Isolation backstop — Phase 2 (WARN mode). A Prisma client extension that, on
 * every operation over a class-A model FROM A TENANT-SCOPED REQUEST, logs a
 * warning when the args carry no tenantId filter. It NEVER modifies the query.
 *
 * Bypass paths (owner portal, platform control lane, admin, auth/register,
 * seed) never populate the tenant ALS, so `tenantId` is undefined for them and
 * they never warn — no manual allow-list needed. Phase 3 flips this to enforce.
 */
export function createTenantIsolationExtension(cls: ClsService) {
	return Prisma.defineExtension({
		name: "tenant-isolation-warn",
		query: {
			$allModels: {
				async $allOperations({ model, operation, args, query }) {
					const tenantId = cls.isActive()
						? cls.get<string | undefined>(TENANT_ID_CLS_KEY)
						: undefined;

					if (
						tenantId !== undefined &&
						TENANT_OWNED_MODELS.has(model) &&
						SCOPED_OPERATIONS.has(operation) &&
						!hasTenantIdInArgs(args)
					) {
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
