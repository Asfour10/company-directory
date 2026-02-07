import passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { OIDCStrategy } from 'passport-azure-ad';
import { AuthService } from './auth.service';
import { prisma } from '../lib/database';

export class SSOService {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // Azure AD OIDC Strategy
    if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID) {
      passport.use('azure-ad', new OIDCStrategy({
        identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0/.well-known/openid_configuration`,
        clientID: process.env.AZURE_AD_CLIENT_ID,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
        responseType: 'code',
        responseMode: 'form_post',
        redirectUrl: process.env.AZURE_AD_CALLBACK_URL!,
        allowHttpForRedirectUrl: process.env.NODE_ENV === 'development',
        validateIssuer: true,
        passReqToCallback: true,
        scope: ['profile', 'email'],
      }, async (req: any, iss: string, sub: string, profile: any, accessToken: string, refreshToken: string, done: any) => {
        try {
          const tenantId = req.tenant?.id;
          if (!tenantId) {
            return done(new Error('Tenant not found'));
          }

          const email = profile._json.email || profile._json.preferred_username;
          const firstName = profile._json.given_name;
          const lastName = profile._json.family_name;
          const title = profile._json.jobTitle;
          const department = profile._json.department;

          const user = await this.authService.findOrCreateUserFromSSO(
            tenantId,
            email,
            sub,
            { firstName, lastName, title, department }
          );

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }));
    }

    // Google OAuth Strategy
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      passport.use('google', new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        passReqToCallback: true,
        scope: ['profile', 'email'],
      }, async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
          const tenantId = req.tenant?.id;
          if (!tenantId) {
            return done(new Error('Tenant not found'));
          }

          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('Email not provided by Google'));
          }

          const firstName = profile.name?.givenName;
          const lastName = profile.name?.familyName;

          const user = await this.authService.findOrCreateUserFromSSO(
            tenantId,
            email,
            profile.id,
            { firstName, lastName }
          );

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }));
    }

    // Generic SAML Strategy (for Okta and other SAML providers)
    if (process.env.SAML_ENTRY_POINT && process.env.SAML_CERT && process.env.SAML_ISSUER && process.env.SAML_CALLBACK_URL) {
      passport.use('saml', new SamlStrategy({
      entryPoint: process.env.SAML_ENTRY_POINT!,
      issuer: process.env.SAML_ISSUER!,
      callbackUrl: process.env.SAML_CALLBACK_URL!,
      cert: process.env.SAML_CERT!,
      passReqToCallback: true,
    }, async (req: any, profile: any, done: any) => {
      try {
        const tenantId = req.tenant?.id;
        if (!tenantId) {
          return done(new Error('Tenant not found'));
        }

        const email = profile.email || profile.nameID;
        const firstName = profile.firstName || profile.givenName;
        const lastName = profile.lastName || profile.surname;
        const title = profile.title;
        const department = profile.department;

        const user = await this.authService.findOrCreateUserFromSSO(
          tenantId,
          email,
          profile.nameID,
          { firstName, lastName, title, department }
        );

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }));
    }
  }

  /**
   * Get SSO configuration for a tenant
   */
  async getTenantSSOConfig(tenantId: string): Promise<any> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        ssoProvider: true,
        ssoConfig: true,
      },
    });

    return tenant;
  }

  /**
   * Update SSO configuration for a tenant
   */
  async updateTenantSSOConfig(
    tenantId: string,
    provider: string,
    config: Record<string, any>
  ): Promise<void> {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ssoProvider: provider,
        ssoConfig: config,
      },
    });
  }

  /**
   * Generate SSO login URL for a provider
   */
  generateSSOLoginURL(provider: string, tenantSubdomain: string): string {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/auth/sso/${provider}/login?tenant=${tenantSubdomain}`;
  }

  /**
   * Handle SSO callback and generate tokens
   */
  async handleSSOCallback(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    // Update last login
    await this.authService.updateLastLogin(user.id);

    // Generate tokens
    const accessToken = this.authService.generateToken(
      user.id,
      user.tenantId,
      user.email,
      user.role
    );
    const refreshToken = this.authService.generateRefreshToken(user.id);

    // Create session
    await this.authService.createSession(user.id, accessToken);

    return { accessToken, refreshToken };
  }

  /**
   * Validate SSO provider is configured for tenant
   */
  async validateSSOProvider(tenantId: string, provider: string): Promise<boolean> {
    const tenant = await this.getTenantSSOConfig(tenantId);
    
    if (!tenant || tenant.ssoProvider !== provider) {
      return false;
    }

    // Additional validation based on provider
    switch (provider) {
      case 'azure-ad':
        return !!(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET);
      case 'google':
        return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
      case 'saml':
        return !!(process.env.SAML_ENTRY_POINT && process.env.SAML_CERT);
      default:
        return false;
    }
  }

  /**
   * Get available SSO providers
   */
  getAvailableProviders(): string[] {
    const providers: string[] = [];

    if (process.env.AZURE_AD_CLIENT_ID) {
      providers.push('azure-ad');
    }
    if (process.env.GOOGLE_CLIENT_ID) {
      providers.push('google');
    }
    if (process.env.SAML_ENTRY_POINT) {
      providers.push('saml');
    }

    return providers;
  }

  /**
   * Create dynamic SAML strategy for tenant-specific configuration
   */
  createTenantSAMLStrategy(tenantConfig: any): SamlStrategy {
    return new SamlStrategy({
      entryPoint: tenantConfig.entryPoint,
      issuer: tenantConfig.issuer,
      callbackUrl: tenantConfig.callbackUrl,
      cert: tenantConfig.cert,
      passReqToCallback: true,
    }, async (req: any, profile: any, done: any) => {
      try {
        const tenantId = req.tenant?.id;
        if (!tenantId) {
          return done(new Error('Tenant not found'));
        }

        const email = profile.email || profile.nameID;
        const firstName = profile.firstName || profile.givenName;
        const lastName = profile.lastName || profile.surname;
        const title = profile.title;
        const department = profile.department;

        const user = await this.authService.findOrCreateUserFromSSO(
          tenantId,
          email,
          profile.nameID,
          { firstName, lastName, title, department }
        );

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    });
  }
}