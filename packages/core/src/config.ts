export type ArbiterMode = 'local' | 'cloud';
export type LLMBackend = 'mock' | 'claude-cli';

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
    backend: LLMBackend;
    openAiApiKey?: string;
    azureOpenAiEndpoint?: string;
    azureOpenAiApiKey?: string;
    azureOpenAiDeployment?: string;
    claudeCli: {
      claudePath: string;
      model: string;
      timeoutMs: number;
    };
  };
  auth: {
    sharedSecret: string;
    entraTenantId?: string;
    entraClientId?: string;
  };
}

const isArbiterMode = (value: string | undefined): value is ArbiterMode =>
  value === 'local' || value === 'cloud';

const isLLMBackend = (value: string | undefined): value is LLMBackend =>
  value === 'mock' || value === 'claude-cli';

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ArbiterConfig => {
  const mode: ArbiterMode = isArbiterMode(env.ARBITER_MODE) ? env.ARBITER_MODE : 'local';
  const backend: LLMBackend = isLLMBackend(env.ARBITER_LLM_BACKEND)
    ? env.ARBITER_LLM_BACKEND
    : mode === 'local'
      ? 'claude-cli'
      : 'mock';
  const timeoutMs = Number(env.CLAUDE_CLI_TIMEOUT_MS);

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
      backend,
      ...(env.OPENAI_API_KEY ? { openAiApiKey: env.OPENAI_API_KEY } : {}),
      ...(env.AZURE_OPENAI_ENDPOINT ? { azureOpenAiEndpoint: env.AZURE_OPENAI_ENDPOINT } : {}),
      ...(env.AZURE_OPENAI_API_KEY ? { azureOpenAiApiKey: env.AZURE_OPENAI_API_KEY } : {}),
      ...(env.AZURE_OPENAI_DEPLOYMENT
        ? { azureOpenAiDeployment: env.AZURE_OPENAI_DEPLOYMENT }
        : {}),
      claudeCli: {
        claudePath: env.CLAUDE_CLI_PATH ?? 'claude',
        model: env.CLAUDE_CLI_MODEL ?? 'claude-sonnet-4-6',
        timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60_000,
      },
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
