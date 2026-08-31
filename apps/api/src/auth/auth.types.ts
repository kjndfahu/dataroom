export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface JwtPayload {
  /** user id */
  sub: string;
  email: string;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
