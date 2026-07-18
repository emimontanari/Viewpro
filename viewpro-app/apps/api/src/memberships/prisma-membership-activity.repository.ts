import { Injectable } from "@nestjs/common";
import type { Prisma, TenantRole } from "@prisma/client";
import { mapActivityFeedMembership } from "../analytics/responses/activity-feed.response";
import { compareActivityItems } from "../analytics/use-cases/list-activity-feed.use-case";
// biome-ignore lint/style/useImportType: Nest dependency injection needs runtime metadata.
import { PrismaService } from "../database/prisma.service";
import type {
	FindManyMembershipActivityInput,
	MembershipActivityActor,
	MembershipActivityDeactivatedRecord,
	MembershipActivityInvitedRecord,
	MembershipActivityJoinedRecord,
	MembershipActivityRecord,
	MembershipActivityRepository,
	MembershipActivityRoleChangedRecord,
} from "./membership-activity.repository";

type ParsedRoleChangedMetadata = {
	memberUserId: string;
	previousRole: TenantRole;
	newRole: TenantRole;
};

/**
 * Defensive parser for AnalyticsEvent.metadata on MEMBER_ROLE_CHANGED rows.
 * The single write path (PrismaMembershipsRepository.updateRoleForTenant)
 * always sets this shape, so a malformed row should never occur — but per
 * this file's existing "never throws" philosophy, malformed/legacy metadata
 * is filtered OUT rather than crashing the whole feed.
 */
function parseRoleChangedMetadata(
	metadata: Prisma.JsonValue,
): ParsedRoleChangedMetadata | null {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return null;
	}
	const value = metadata as Record<string, unknown>;
	if (
		typeof value.memberUserId !== "string" ||
		typeof value.previousRole !== "string" ||
		typeof value.newRole !== "string"
	) {
		return null;
	}
	return {
		memberUserId: value.memberUserId,
		previousRole: value.previousRole as TenantRole,
		newRole: value.newRole as TenantRole,
	};
}

const ACTOR_SELECT = { id: true, email: true, firstName: true } as const;

/**
 * Hard upper bound on how many rows are fetched from EACH sub-stream in a
 * single request — mirrors `MAX_FETCH_WINDOW` in
 * `get-platform-tenant-activity.use-case.ts`. See the merge/slice comment in
 * `findManyByTenant` for why the slice upper bound is the fetched window,
 * never the uncapped `offset + pageSize`.
 */
const MAX_FETCH_WINDOW = 200;

/**
 * PrismaMembershipActivityRepository — derives INVITED/JOINED/DEACTIVATED
 * membership activity from existing `TeamInvitation`/`TenantMembership`
 * rows. Zero new writes, zero migration (design D1).
 *
 * Runs 3 bounded sub-queries in parallel, each with an UNCONDITIONAL
 * top-level `where: { tenantId }` (never nested/conditional — the same
 * discipline as `prisma-memberships.repository.ts`), then merges/sorts/slices
 * internally so the return shape behaves exactly like a homogeneous stream
 * from the caller's point of view:
 *
 * 1. INVITED  ← teamInvitation, no predicate beyond tenantId.
 * 2. JOINED   ← tenantMembership, `role: { not: 'PRINCIPAL_MANAGER' }` —
 *    excludes the tenant-creation first-owner membership (D1b: exact
 *    role-based predicate, not a fuzzy timestamp heuristic).
 * 3. DEACTIVATED ← tenantMembership, `status: 'DEACTIVATED', deactivatedAt: { not: null }`.
 *    `TenantMembership.deactivatedByUserId` has NO Prisma relation, so the
 *    deactivating actor is resolved via a SEPARATE batch `User.findMany`
 *    lookup over the deduped ids (D1).
 *
 * Record `id` is left RAW (the underlying invitation/membership id) — the
 * globally-unique `membership-{invited,joined,deactivated}:` prefix is
 * applied later by `mapActivityFeedMembership`.
 */
@Injectable()
export class PrismaMembershipActivityRepository
	implements MembershipActivityRepository
{
	constructor(private readonly prisma: PrismaService) {}

	async findManyByTenant(
		input: FindManyMembershipActivityInput,
	): Promise<{ items: MembershipActivityRecord[]; total: number }> {
		const { tenantId, pageSize } = input;
		// Window-bound merged-stream pagination (mirrors
		// GetPlatformTenantActivityUseCase). The 3 sub-streams are each ordered
		// independently, so a per-sub-query `skip = offset` would drop/duplicate
		// items across pages once page>1. Instead each sub-query is fetched from
		// skip 0 with `take = min(offset + pageSize, MAX_FETCH_WINDOW)`: the
		// global top-K of the merge is always a subset of the union of each
		// sub-stream's own top-K, so this window is sufficient to build the
		// correct combined page.
		const offset = Math.max(input.page - 1, 0) * pageSize;
		const fetchWindow = Math.min(offset + pageSize, MAX_FETCH_WINDOW);

		const [
			invitationRows,
			invitationTotal,
			joinedRows,
			joinedTotal,
			deactivatedRows,
			deactivatedTotal,
			roleChangedRows,
			roleChangedTotal,
		] = await Promise.all([
			this.prisma.teamInvitation.findMany({
				where: { tenantId },
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				skip: 0,
				take: fetchWindow,
				include: { invitedByUser: { select: ACTOR_SELECT } },
			}),
			this.prisma.teamInvitation.count({ where: { tenantId } }),
			this.prisma.tenantMembership.findMany({
				where: { tenantId, role: { not: "PRINCIPAL_MANAGER" } },
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				skip: 0,
				take: fetchWindow,
				include: { user: { select: ACTOR_SELECT } },
			}),
			this.prisma.tenantMembership.count({
				where: { tenantId, role: { not: "PRINCIPAL_MANAGER" } },
			}),
			this.prisma.tenantMembership.findMany({
				where: { tenantId, status: "DEACTIVATED", deactivatedAt: { not: null } },
				orderBy: [{ deactivatedAt: "desc" }, { id: "desc" }],
				skip: 0,
				take: fetchWindow,
				include: { user: { select: ACTOR_SELECT } },
			}),
			this.prisma.tenantMembership.count({
				where: { tenantId, status: "DEACTIVATED", deactivatedAt: { not: null } },
			}),
			// 4th source (platform-role-change-activity): AnalyticsEvent rows
			// written by the atomic role-change write path
			// (prisma-memberships.repository.ts). Direct query — NOT through
			// AnalyticsRepository.listTenantEvents, which paginates with a
			// different skip/take shape that doesn't fit this window-bounded
			// merge (design §4). UNCONDITIONAL top-level tenantId, same
			// discipline as the 3 sub-queries above.
			this.prisma.analyticsEvent.findMany({
				where: { tenantId, eventName: "MEMBER_ROLE_CHANGED" },
				orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
				skip: 0,
				take: fetchWindow,
			}),
			this.prisma.analyticsEvent.count({
				where: { tenantId, eventName: "MEMBER_ROLE_CHANGED" },
			}),
		]);

		// Malformed/legacy metadata rows (should never occur given the single
		// write path always sets it) are filtered OUT rather than crashing —
		// consistent with describeMembershipActivityItem's "never throws"
		// discipline on the FE side.
		const parsedRoleChanges = roleChangedRows
			.map((row) => ({ row, parsed: parseRoleChangedMetadata(row.metadata) }))
			.filter(
				(
					entry,
				): entry is {
					row: (typeof roleChangedRows)[number];
					parsed: ParsedRoleChangedMetadata;
				} => entry.parsed !== null,
			);

		const deactivatedByUserIds = deactivatedRows
			.map((row) => row.deactivatedByUserId)
			.filter((id): id is string => Boolean(id));
		// Consolidated batch lookup: covers deactivatedByUser ids AND the
		// role-changed subject (memberUserId) + actor (actorUserId) ids in ONE
		// round trip (design §4) — never a second User.findMany call.
		const lookupIds = Array.from(
			new Set([
				...deactivatedByUserIds,
				...parsedRoleChanges.flatMap(({ row, parsed }) =>
					row.actorUserId
						? [parsed.memberUserId, row.actorUserId]
						: [parsed.memberUserId],
				),
			]),
		);
		const actorUsers: MembershipActivityActor[] = lookupIds.length
			? await this.prisma.user.findMany({
					where: { id: { in: lookupIds } },
					select: ACTOR_SELECT,
				})
			: [];
		const actorsById = new Map(actorUsers.map((user) => [user.id, user]));

		const invitedRecords: MembershipActivityInvitedRecord[] =
			invitationRows.map((row) => ({
				event: "INVITED",
				id: row.id,
				tenantId: row.tenantId,
				createdAt: row.createdAt,
				email: row.email,
				invitedByUser: row.invitedByUser,
			}));

		const joinedRecords: MembershipActivityJoinedRecord[] = joinedRows.map(
			(row) => ({
				event: "JOINED",
				id: row.id,
				tenantId: row.tenantId,
				createdAt: row.createdAt,
				user: row.user,
			}),
		);

		const deactivatedRecords: MembershipActivityDeactivatedRecord[] =
			deactivatedRows.map((row) => ({
				event: "DEACTIVATED",
				id: row.id,
				tenantId: row.tenantId,
				// Normalized createdAt = the event's own relevant timestamp
				// (deactivatedAt, not the row's original createdAt) — required so
				// this record sorts correctly against INVITED/JOINED events.
				createdAt: row.deactivatedAt ?? row.createdAt,
				user: row.user,
				deactivatedByUser: row.deactivatedByUserId
					? (actorsById.get(row.deactivatedByUserId) ?? null)
					: null,
			}));

		// subject fallback is a placeholder object (never null) — ROLE_CHANGED's
		// subject must always exist for the mapper/FE, unlike DEACTIVATED's
		// optional actor.
		const roleChangedRecords: MembershipActivityRoleChangedRecord[] =
			parsedRoleChanges.map(({ row, parsed }) => ({
				event: "ROLE_CHANGED",
				id: row.id,
				tenantId: row.tenantId ?? tenantId,
				createdAt: row.occurredAt,
				subject: actorsById.get(parsed.memberUserId) ?? {
					id: parsed.memberUserId,
					email: "",
					firstName: "",
				},
				actor: row.actorUserId
					? (actorsById.get(row.actorUserId) ?? {
							id: row.actorUserId,
							email: "",
							firstName: "",
						})
					: null,
				previousRole: parsed.previousRole,
				newRole: parsed.newRole,
			}));

		// Sort with the SAME comparator the outer merge uses
		// (`compareActivityItems` over `mapActivityFeedMembership`'s prefixed id),
		// so this internal ordering agrees with `GetPlatformTenantActivityUseCase`'s
		// re-sort down to the tie-break — the outer tie-break is on the PREFIXED
		// id, not the raw row id, and prefixes differ per event type.
		//
		// Slice `[offset, fetchWindow)`: the upper bound is the fetched window,
		// NEVER the uncapped `offset + pageSize`. Positions beyond the window may
		// not have been fetched, so a page whose `offset >= fetchWindow` returns
		// EMPTY rather than wrong/unrelated items, while `total` stays the true
		// combined count. `page:1` is `[0, pageSize)` — identical to before.
		const items: MembershipActivityRecord[] = [
			...invitedRecords,
			...joinedRecords,
			...deactivatedRecords,
			...roleChangedRecords,
		]
			.map((record) => ({ record, mapped: mapActivityFeedMembership(record) }))
			.sort((a, b) => compareActivityItems(a.mapped, b.mapped))
			.slice(offset, fetchWindow)
			.map((entry) => entry.record);

		return {
			items,
			total: invitationTotal + joinedTotal + deactivatedTotal + roleChangedTotal,
		};
	}
}
