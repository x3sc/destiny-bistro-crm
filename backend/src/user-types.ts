import type { AuthRole, AuthUser } from "./auth-types.js";

export const userRoleCodes = ["OWNER", "MANAGER", "WAITER", "KITCHEN"] as const;
export type UserRoleCode = (typeof userRoleCodes)[number];
export interface AdminUser {
  roleVersion?: number;
  permissions?: string[];
  canReassign?: boolean;
  id: string;
  name: string;
  active: boolean;
  roles: AuthRole[];
}
export interface CreateUserInput {
  name: string;
  password: string;
  roleCode?: UserRoleCode;
  roleId?: string;
}
export interface AdminUsers {
  users: AdminUser[];
  roles: AuthRole[];
}
export interface UserRepository {
  list(actor: AuthUser): Promise<AdminUsers>;
  create(actor: AuthUser, input: CreateUserInput): Promise<AdminUser>;
  updateRole?(actor: AuthUser, id: string, roleId: string, expectedVersion: number): Promise<AdminUser>;
}
export class UserAccessError extends Error {}
export function canManageUsers(actor: AuthUser) {
  return actor.permissions.includes("users.manage");
}
