// src/modules/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import type { RefreshPrincipal } from './strategies/jwt-refresh.strategy';
import type { GoogleProfile } from './strategies/google.strategy';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';

const REFRESH_COOKIE = 'refreshToken';
type RequestWithCookies = Request & { cookies?: Record<string, string>; user?: unknown };

/** All auth endpoints are rate limited to ≤10 req/min/IP (NF-11). */
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.auth.signup(dto);
    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.auth.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return { user, accessToken };
  }

  @Public() // bypass the global access-token guard; authenticated via the refresh cookie instead
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: RequestWithCookies, @Res({ passthrough: true }) res: Response) {
    const principal = req.user as RefreshPrincipal;
    const { accessToken, refreshToken } = await this.auth.refresh(
      principal.userId,
      principal.tokenId,
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
    @Query('all') all?: string,
  ): Promise<void> {
    const raw = req.cookies?.[REFRESH_COOKIE] ?? null;
    await this.auth.logout(user.id, raw, all === 'true');
    this.clearRefreshCookie(res);
  }

  /** Start Google OAuth (FR-02): passport redirects (302) to the consent screen. */
  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  googleStart(): void {
    // GoogleOAuthGuard triggers the redirect to Google; this body never runs.
  }

  /**
   * Google OAuth callback (FR-02). Sets the httpOnly refresh cookie and redirects
   * to the frontend with NO access token in the URL — the FE then calls
   * `POST /auth/refresh` to obtain it. On a denied/failed handshake, redirects to
   * `/login?error=oauth_failed`.
   */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(@Req() req: RequestWithCookies, @Res() res: Response): Promise<void> {
    const webOrigin = this.config.get<string>('webOrigin');
    const profile = req.user as GoogleProfile | null;
    if (!profile) {
      res.redirect(`${webOrigin}/login?error=oauth_failed`);
      return;
    }
    try {
      const { refreshToken } = await this.auth.oauthLogin(profile);
      this.setRefreshCookie(res, refreshToken);
      res.redirect(`${webOrigin}/auth/callback`);
    } catch {
      res.redirect(`${webOrigin}/login?error=oauth_failed`);
    }
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get<string>('nodeEnv') === 'production',
      sameSite: 'strict',
      domain: this.config.get<string>('cookie.domain'),
      path: '/api/auth',
    };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: (this.config.get<number>('jwt.refreshTtl') as number) * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }
}
