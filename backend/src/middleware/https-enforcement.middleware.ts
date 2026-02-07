import { Request, Response, NextFunction } from 'express';
import https from 'https';
import fs from 'fs';

export interface HttpsConfig {
  enforceHttps: boolean;
  hstsMaxAge: number;
  hstsIncludeSubDomains: boolean;
  hstsPreload: boolean;
  tlsVersion: string;
  cipherSuites: string[];
}

/**
 * Middleware to enforce HTTPS and set security headers
 */
export function httpsEnforcementMiddleware(config: HttpsConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Set HSTS (HTTP Strict Transport Security) headers
    if (config.enforceHttps) {
      let hstsValue = `max-age=${config.hstsMaxAge}`;
      
      if (config.hstsIncludeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      
      if (config.hstsPreload) {
        hstsValue += '; preload';
      }
      
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // Redirect HTTP to HTTPS in production
    if (config.enforceHttps && req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }

    // Set additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Set secure cookie attributes
    if (config.enforceHttps) {
      const originalSetHeader = res.setHeader;
      res.setHeader = function(name: string, value: any) {
        if (name.toLowerCase() === 'set-cookie' && Array.isArray(value)) {
          value = value.map(cookie => {
            if (typeof cookie === 'string' && !cookie.includes('Secure')) {
              return cookie + '; Secure; SameSite=Strict';
            }
            return cookie;
          });
        }
        return originalSetHeader.call(this, name, value);
      };
    }

    next();
  };
}

/**
 * Create HTTPS server configuration
 */
export function createHttpsServerConfig(): {
  key?: Buffer;
  cert?: Buffer;
  ca?: Buffer;
  secureOptions?: number;
  ciphers?: string;
  honorCipherOrder?: boolean;
} {
  const config: any = {};

  // Load SSL certificates if available
  try {
    if (process.env.SSL_KEY_PATH && fs.existsSync(process.env.SSL_KEY_PATH)) {
      config.key = fs.readFileSync(process.env.SSL_KEY_PATH);
    }
    
    if (process.env.SSL_CERT_PATH && fs.existsSync(process.env.SSL_CERT_PATH)) {
      config.cert = fs.readFileSync(process.env.SSL_CERT_PATH);
    }
    
    if (process.env.SSL_CA_PATH && fs.existsSync(process.env.SSL_CA_PATH)) {
      config.ca = fs.readFileSync(process.env.SSL_CA_PATH);
    }
  } catch (error) {
    console.warn('SSL certificate loading failed:', error);
  }

  // Configure TLS settings
  config.secureOptions = 
    require('constants').SSL_OP_NO_SSLv2 |
    require('constants').SSL_OP_NO_SSLv3 |
    require('constants').SSL_OP_NO_TLSv1 |
    require('constants').SSL_OP_NO_TLSv1_1; // Only allow TLS 1.2+

  // Configure secure cipher suites
  config.ciphers = [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-SHA256',
    'ECDHE-RSA-AES256-SHA384',
    'ECDHE-RSA-AES256-SHA256',
    'ECDHE-RSA-AES128-SHA',
    'ECDHE-RSA-AES256-SHA',
    'AES128-GCM-SHA256',
    'AES256-GCM-SHA384',
    'AES128-SHA256',
    'AES256-SHA256',
    'AES128-SHA',
    'AES256-SHA',
    'DES-CBC3-SHA'
  ].join(':');

  config.honorCipherOrder = true;

  return config;
}

/**
 * Default HTTPS configuration
 */
export const defaultHttpsConfig: HttpsConfig = {
  enforceHttps: process.env.NODE_ENV === 'production',
  hstsMaxAge: 31536000, // 1 year
  hstsIncludeSubDomains: true,
  hstsPreload: true,
  tlsVersion: '1.3',
  cipherSuites: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-GCM-SHA256'
  ]
};

/**
 * Verify TLS configuration
 */
export async function verifyTlsConfiguration(): Promise<{
  httpsSupported: boolean;
  tlsVersion: string;
  cipherSuites: string[];
  hstsEnabled: boolean;
  certificateValid: boolean;
  details: string;
}> {
  try {
    const hasSSLCerts = !!(process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH);
    const httpsEnforced = process.env.ENFORCE_HTTPS === 'true' || process.env.NODE_ENV === 'production';
    
    return {
      httpsSupported: hasSSLCerts,
      tlsVersion: defaultHttpsConfig.tlsVersion,
      cipherSuites: defaultHttpsConfig.cipherSuites,
      hstsEnabled: httpsEnforced,
      certificateValid: hasSSLCerts,
      details: `HTTPS: ${hasSSLCerts ? 'Configured' : 'Not configured'}, HSTS: ${httpsEnforced ? 'Enabled' : 'Disabled'}`
    };
  } catch (error) {
    return {
      httpsSupported: false,
      tlsVersion: 'Unknown',
      cipherSuites: [],
      hstsEnabled: false,
      certificateValid: false,
      details: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Create HTTPS server if certificates are available
 */
export function createHttpsServer(app: any): https.Server | null {
  try {
    const httpsConfig = createHttpsServerConfig();
    
    if (httpsConfig.key && httpsConfig.cert) {
      return https.createServer(httpsConfig, app);
    }
    
    return null;
  } catch (error) {
    console.error('Failed to create HTTPS server:', error);
    return null;
  }
}