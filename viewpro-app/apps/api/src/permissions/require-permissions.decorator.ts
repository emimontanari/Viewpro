import { SetMetadata } from "@nestjs/common";
import type { Permission } from "./permissions.constants";

export const REQUIRED_PERMISSIONS_KEY = "required_permissions";
export const REQUIRED_ANY_PERMISSIONS_KEY = "required_any_permissions";

export const RequirePermissions = (...permissions: Permission[]) =>
	SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
export const RequireAnyPermission = (...permissions: Permission[]) =>
	SetMetadata(REQUIRED_ANY_PERMISSIONS_KEY, permissions);
