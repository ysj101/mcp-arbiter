import type { ArbiterConfig } from '../config.js';
import {
  type AuthAdapter,
  EntraIdAuthAdapter,
  type EntraJwtPayload,
  LocalBearerAuthAdapter,
} from './auth-adapter.js';

export interface AuthFactoryOptions {
  verifyEntraJwt?: (token: string) => Promise<EntraJwtPayload>;
}

export const createAuthAdapter = (
  config: ArbiterConfig,
  options: AuthFactoryOptions = {},
): AuthAdapter => {
  if (config.mode === 'cloud') {
    if (!config.auth.entraTenantId || !config.auth.entraClientId) {
      throw new Error('cloud mode requires ENTRA_TENANT_ID / ENTRA_CLIENT_ID to be set');
    }
    if (!options.verifyEntraJwt) {
      throw new Error('cloud mode requires verifyEntraJwt implementation');
    }
    return new EntraIdAuthAdapter({
      tenantId: config.auth.entraTenantId,
      clientId: config.auth.entraClientId,
      verifyJwt: options.verifyEntraJwt,
    });
  }
  return new LocalBearerAuthAdapter({ sharedSecret: config.auth.sharedSecret });
};
