import type { ArbiterConfig } from '../config.js';
import { ClaudeCliLLMAdapter } from './claude-cli-llm-adapter.js';
import {
  AzureFoundryAgentLLMAdapter,
  type AzureFoundryAgentOptions,
  type LLMAdapter,
  MockLLMAdapter,
} from './llm-adapter.js';

export interface LLMFactoryOptions {
  callAgent?: AzureFoundryAgentOptions['callAgent'];
}

export const createLLMAdapter = (
  config: ArbiterConfig,
  options: LLMFactoryOptions = {},
): LLMAdapter => {
  if (config.mode === 'cloud') {
    const { azureOpenAiEndpoint, azureOpenAiApiKey, azureOpenAiDeployment } = config.llm;
    if (!azureOpenAiEndpoint || !azureOpenAiApiKey || !azureOpenAiDeployment) {
      throw new Error('cloud mode requires AZURE_OPENAI_* to be set');
    }
    if (!options.callAgent) {
      throw new Error('cloud mode requires callAgent implementation');
    }
    return new AzureFoundryAgentLLMAdapter({
      endpoint: azureOpenAiEndpoint,
      apiKey: azureOpenAiApiKey,
      deployment: azureOpenAiDeployment,
      callAgent: options.callAgent,
    });
  }

  switch (config.llm.backend) {
    case 'mock':
      return new MockLLMAdapter();
    case 'claude-cli':
      return new ClaudeCliLLMAdapter(config.llm.claudeCli);
    default: {
      const exhaustive: never = config.llm.backend;
      throw new Error(`unknown ARBITER_LLM_BACKEND: ${String(exhaustive)}`);
    }
  }
};
