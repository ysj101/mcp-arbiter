export type ArbiterMode = 'local' | 'cloud';

export interface ArbiterConfig {
  mode: ArbiterMode;
  cosmos: {
    endpoint: string;
    key: string;
    database: string;
  };
  signalr: {
    connectionString: string;
  };
  llm: {
    openAiApiKey?: string;
    azureOpenAiEndpoint?: string;
    azureOpenAiApiKey?: string;
    azureOpenAiDeployment?: string;
  };
  auth: {
    sharedSecret: string;
    entraTenantId?: string;
    entraClientId?: string;
  };
}

const isArbiterMode = (value: string | undefined): value is ArbiterMode =>
  value === 'local' || value === 'cloud';

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ArbiterConfig => {
  const mode: ArbiterMode = isArbiterMode(env.ARBITER_MODE) ? env.ARBITER_MODE : 'local';

  return {
    mode,
    cosmos: {
      endpoint: env.COSMOS_ENDPOINT ?? 'https://localhost:8081',
      key: env.COSMOS_KEY ?? '',
      database: env.COSMOS_DATABASE ?? 'arbiter',
    },
    signalr: {
      connectionString: env.SIGNALR_CONNECTION_STRING ?? '',
    },
    llm: {
      ...(env.OPENAI_API_KEY ? { openAiApiKey: env.OPENAI_API_KEY } : {}),
      ...(env.AZURE_OPENAI_ENDPOINT ? { azureOpenAiEndpoint: env.AZURE_OPENAI_ENDPOINT } : {}),
      ...(env.AZURE_OPENAI_API_KEY ? { azureOpenAiApiKey: env.AZURE_OPENAI_API_KEY } : {}),
      ...(env.AZURE_OPENAI_DEPLOYMENT
        ? { azureOpenAiDeployment: env.AZURE_OPENAI_DEPLOYMENT }
        : {}),
    },
    auth: {
      sharedSecret: env.ARBITER_SHARED_SECRET ?? 'dev-shared-secret-change-me',
      ...(env.ENTRA_TENANT_ID ? { entraTenantId: env.ENTRA_TENANT_ID } : {}),
      ...(env.ENTRA_CLIENT_ID ? { entraClientId: env.ENTRA_CLIENT_ID } : {}),
    },
  };
};

export const isLocal = (cfg: ArbiterConfig): boolean => cfg.mode === 'local';
export const isCloud = (cfg: ArbiterConfig): boolean => cfg.mode === 'cloud';
