import type { AuthRole, AuthUser } from "./auth-types.js";

export const userRoleCodes = ["OWNER", "MANAGER", "WAITER", "KITCHEN"] as const;
export type UserRoleCode = (typeof userRoleCodes)[number];
export interface AdminUser {
  id: string;
  name: string;
  active: boolean;
  roles: AuthRole[];
}
export interface CreateUserInput {
  name: string;
  password: string;
  roleCode: UserRoleCode;
}
export interface AdminUsers {
  users: AdminUser[];
  roles: AuthRole[];
}
export interface UserRepository {
  list(actor: AuthUser): Promise<AdminUsers>;
  create(actor: AuthUser, input: CreateUserInput): Promise<AdminUser>;
}
export class UserAccessError extends Error {}
export function canManageUsers(actor: AuthUser) {
  return actor.permissions.includes("users.manage") &&
    actor.roles.some(({ code }) => code === "OWNER");
}
