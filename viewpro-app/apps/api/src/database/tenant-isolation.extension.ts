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
export const TENANT_OWNED_MODELS: ReadonlySet<string> = new Set([
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
	"FeedbackReport",
	"FeedbackSubmissionAttempt",
]);

/**
 * Ops whose `where` accepts a `tenantId` filter — the extension INJECTS
 * `where.tenantId` from the ALS when absent (enforce). This includes unique-keyed
 * `update`/`delete`: Prisma (>=5) allows extra non-unique filters alongside the
 * unique key, so `where: { id, tenantId }` targets the row only when it belongs
 * to the tenant and otherwise raises P2025 (not found) without mutating.
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
	"update",
	"delete",
]);

/**
 * Unique-keyed READS (findUnique/findUniqueOrThrow). Prisma rejects a non-unique
 * `tenantId` in their `where`, so instead of injecting we ENFORCE by post-fetch
 * validation: run the query, then discard a row that belongs to another tenant.
 */
const UNIQUE_READ_OPERATIONS: ReadonlySet<string> = new Set([
	"findUnique",
	"findUniqueOrThrow",
]);

/**
 * `upsert` stays WARN only: its create-or-update semantics make a blind
 * tenantId injection into the `where` unsafe (a mismatched tenant would fall
 * through to the create path). Left for a dedicated follow-up.
 */
const WARN_ONLY_OPERATIONS: ReadonlySet<string> = new Set(["upsert"]);

/**
 * Isolation backstop — Phase 3c (ENFORCE reads, bulk, unique-keyed reads AND
 * unique-keyed update/delete; WARN only upsert). A Prisma client extension that,
 * for class-A models operated on FROM A TENANT-SCOPED REQUEST:
 *  - injects `where.tenantId` (from the ALS) into where-injectable operations,
 *    including update/delete — a cross-tenant target raises P2025 (not found)
 *    without mutating;
 *  - post-fetch-validates findUnique/findUniqueOrThrow: a row belonging to
 *    another tenant is returned as null / raised as P2025;
 *  - only warns on upsert (unsafe to blind-inject; dedicated follow-up).
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

					if (UNIQUE_READ_OPERATIONS.has(operation)) {
						return enforceUniqueRead(
							model,
							operation,
							args,
							query as (args: unknown) => Promise<unknown>,
							tenantId,
						);
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
 * Enforce tenant scope on a unique-keyed read (findUnique/findUniqueOrThrow):
 * run the query, then discard a row that belongs to another tenant. `tenantId`
 * is force-selected when the caller used a restrictive `select` so we can always
 * validate, then stripped from the result to honour the original select.
 */
export async function enforceUniqueRead(
	model: string,
	operation: string,
	args: unknown,
	query: (args: unknown) => Promise<unknown>,
	tenantId: string,
): Promise<unknown> {
	const { scopedArgs, addedTenantId } = ensureTenantIdSelected(args);
	const result = (await query(scopedArgs)) as Record<string, unknown> | null;

	if (result && result.tenantId !== tenantId) {
		if (operation === "findUniqueOrThrow") {
			throw new Prisma.PrismaClientKnownRequestError(
				`No ${model} found`,
				{ code: "P2025", clientVersion: Prisma.prismaVersion.client },
			);
		}
		return null;
	}

	if (result && addedTenantId) {
		delete result.tenantId;
	}

	return result;
}

/**
 * Ensure the row's `tenantId` will be present in the result so it can be
 * validated. Only relevant when the caller passed a `select` that omits it;
 * a query with no select (or with `include`) already returns all scalar fields.
 */
function ensureTenantIdSelected(args: unknown): {
	scopedArgs: unknown;
	addedTenantId: boolean;
} {
	if (!args || typeof args !== "object") {
		return { scopedArgs: args, addedTenantId: false };
	}

	const base = args as Record<string, unknown>;
	const select = base.select;

	if (!select || typeof select !== "object" || "tenantId" in select) {
		return { scopedArgs: args, addedTenantId: false };
	}

	return {
		scopedArgs: {
			...base,
			select: { ...(select as Record<string, unknown>), tenantId: true },
		},
		addedTenantId: true,
	};
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
