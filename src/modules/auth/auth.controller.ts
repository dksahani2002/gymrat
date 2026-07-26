import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthApplicationService } from '../../application/identity/auth.application-service';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { BusinessError } from '../../shared/errors/base.error';
import { ErrorCodes } from '../../shared/errors/error-codes';
import {
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';

type RequestWithMeta = Request & { requestId?: string };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthApplicationService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register with email and password' })
  @ApiResponse({ status: 201, description: 'User registered' })
  @ApiResponse({ status: 409, description: 'Email already taken' })
  async register(@Body() dto: RegisterDto, @Req() req: RequestWithMeta) {
    return this.authService.register({
      email: dto.email,
      password: dto.password,
      displayName: dto.displayName,
      context: this.contextFrom(req),
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Req() req: RequestWithMeta) {
    return this.authService.login({
      email: dto.email,
      password: dto.password,
      context: this.contextFrom(req),
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: RequestWithMeta) {
    return this.authService.refresh({
      refreshToken: dto.refreshToken,
      context: this.contextFrom(req),
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh token family or all sessions' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LogoutDto,
    @Req() req: RequestWithMeta,
  ): Promise<void> {
    await this.authService.logout({
      userId: user.id,
      refreshToken: dto.refreshToken,
      context: this.contextFrom(req),
    });
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request password reset email (always returns 202)',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: RequestWithMeta,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword({
      email: dto.email,
      context: this.contextFrom(req),
    });
    return { message: 'If an account exists, a reset email has been sent' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reset password using emailed token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: RequestWithMeta,
  ): Promise<void> {
    await this.authService.resetPassword({
      token: dto.token,
      newPassword: dto.newPassword,
      context: this.contextFrom(req),
    });
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login or register with a Google ID token' })
  async google(@Body() dto: GoogleLoginDto, @Req() req: RequestWithMeta) {
    if (!this.config.get<boolean>('features.googleAuth', true)) {
      throw new BusinessError(
        'Google auth is disabled',
        ErrorCodes.BUSINESS_ERROR,
        503,
      );
    }
    return this.authService.googleLogin({
      idToken: dto.idToken,
      context: this.contextFrom(req),
    });
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the current authenticated principal' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  private contextFrom(req: RequestWithMeta) {
    return {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      requestId: req.requestId ?? null,
    };
  }
}
