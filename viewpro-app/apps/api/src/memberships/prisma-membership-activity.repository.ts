import { Injectable } from "@nestjs/common";
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
} from "./membership-activity.repository";

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
		]);

		const deactivatedByUserIds = Array.from(
			new Set(
				deactivatedRows
					.map((row) => row.deactivatedByUserId)
					.filter((id): id is string => Boolean(id)),
			),
		);
		const actorUsers: MembershipActivityActor[] = deactivatedByUserIds.length
			? await this.prisma.user.findMany({
					where: { id: { in: deactivatedByUserIds } },
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
		]
			.map((record) => ({ record, mapped: mapActivityFeedMembership(record) }))
			.sort((a, b) => compareActivityItems(a.mapped, b.mapped))
			.slice(offset, fetchWindow)
			.map((entry) => entry.record);

		return {
			items,
			total: invitationTotal + joinedTotal + deactivatedTotal,
		};
	}
}
