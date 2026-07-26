export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface AuthUserView {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export interface AuthResult {
  user: AuthUserView;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresAt: Date;
}

export interface RegisterCommand {
  email: string;
  password: string;
  displayName?: string;
  context: RequestContext;
}

export interface LoginCommand {
  email: string;
  password: string;
  context: RequestContext;
}

export interface RefreshCommand {
  refreshToken: string;
  context: RequestContext;
}

export interface LogoutCommand {
  userId: string;
  refreshToken?: string;
  context: RequestContext;
}

export interface ForgotPasswordCommand {
  email: string;
  context: RequestContext;
}

export interface ResetPasswordCommand {
  token: string;
  newPassword: string;
  context: RequestContext;
}

export interface GoogleLoginCommand {
  idToken: string;
  context: RequestContext;
}
