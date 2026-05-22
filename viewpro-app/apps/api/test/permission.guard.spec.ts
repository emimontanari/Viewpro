import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsController } from "../src/analytics/analytics.controller";
import { PermissionGuard } from "../src/permissions/permission.guard";
import {
	PERMISSIONS,
	type Permission,
} from "../src/permissions/permissions.constants";
import {
	REQUIRED_ANY_PERMISSIONS_KEY,
	REQUIRED_PERMISSIONS_KEY,
} from "../src/permissions/require-permissions.decorator";

function createExecutionContext(permissions: Permission[]): ExecutionContext {
	return {
		getClass: () => class TestController {},
		getHandler: () => function testHandler() {},
		switchToHttp: () => ({
			getRequest: () => ({ tenantContext: { permissions } }),
		}),
	} as unknown as ExecutionContext;
}

function createGuard({
	requiredAnyPermissions = [],
	requiredPermissions = [],
}: {
	requiredAnyPermissions?: Permission[];
	requiredPermissions?: Permission[];
}) {
	const reflector = {
		getAllAndOverride: vi.fn((key: string) => {
			if (key === REQUIRED_PERMISSIONS_KEY) {
				return requiredPermissions;
			}

			if (key === REQUIRED_ANY_PERMISSIONS_KEY) {
				return requiredAnyPermissions;
			}

			return undefined;
		}),
	};

	return new PermissionGuard(reflector as unknown as Reflector);
}

describe("PermissionGuard", () => {
	it("allows existing all-permission requirements when every permission is present", () => {
		const guard = createGuard({
			requiredPermissions: [
				PERMISSIONS.TENANT_VIEW,
				PERMISSIONS.ENGAGEMENTS_VIEW_ALL,
			],
		});

		expect(
			guard.canActivate(
				createExecutionContext([
					PERMISSIONS.TENANT_VIEW,
					PERMISSIONS.ENGAGEMENTS_VIEW_ALL,
				]),
			),
		).toBe(true);
	});

	it("allows activity-feed manager visibility through any-permission requirements", () => {
		const guard = createGuard({
			requiredAnyPermissions: [
				PERMISSIONS.ENGAGEMENTS_VIEW_ALL,
				PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED,
			],
		});

		expect(
			guard.canActivate(
				createExecutionContext([PERMISSIONS.ENGAGEMENTS_VIEW_ALL]),
			),
		).toBe(true);
	});

	it("allows activity-feed assigned-agent visibility through any-permission requirements", () => {
		const guard = createGuard({
			requiredAnyPermissions: [
				PERMISSIONS.ENGAGEMENTS_VIEW_ALL,
				PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED,
			],
		});

		expect(
			guard.canActivate(
				createExecutionContext([PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED]),
			),
		).toBe(true);
	});

	it("rejects users without any required activity-feed visibility permission", () => {
		const guard = createGuard({
			requiredAnyPermissions: [
				PERMISSIONS.ENGAGEMENTS_VIEW_ALL,
				PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED,
			],
		});

		expect(() =>
			guard.canActivate(createExecutionContext([PERMISSIONS.TENANT_VIEW])),
		).toThrow(ForbiddenException);
	});
});

describe("AnalyticsController permissions", () => {
	it("declares activity-feed as engagement-view-all or engagement-view-assigned", () => {
		const reflector = new Reflector();
		const handler = AnalyticsController.prototype.activityFeed;

		expect(
			reflector.get<Permission[]>(REQUIRED_ANY_PERMISSIONS_KEY, handler),
		).toEqual([
			PERMISSIONS.ENGAGEMENTS_VIEW_ALL,
			PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED,
		]);
		expect(
			reflector.get<Permission[]>(REQUIRED_PERMISSIONS_KEY, handler),
		).toBeUndefined();
	});
});
