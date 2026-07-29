export interface AuthRole {
  code: string;
  id: string;
  name: string;
}

export interface AuthUser {
  id: string;
  name: string;
  permissions: string[];
  roles: AuthRole[];
}

export interface AuthSessionResult {
  expiresAt: string;
  token: string;
  user: AuthUser;
}

export interface AuthRepository {
  authenticate(token: string): Promise<AuthUser | null>;
  login(name: string, password: string): Promise<AuthSessionResult>;
  logout(token: string): Promise<void>;
}

export class AuthCredentialsError extends Error {}
export class AuthInputError extends Error {}
export class UserProvisionConflictError extends Error {}
