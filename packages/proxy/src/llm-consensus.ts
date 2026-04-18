import type { LLMAdapter } from '@arbiter/core';
import type { Intent, SubAgentOpinion } from '@arbiter/shared-types';

export interface JudgeProfile {
  role: string;
  systemPrompt: string;
}

export const DEFAULT_JUDGE_PROFILES: readonly JudgeProfile[] = [
  {
    role: 'privacy-officer',
    systemPrompt: 'あなたは個人情報保護の観点から審理するプライバシーオフィサーです。',
  },
  {
    role: 'hr-leader',
    systemPrompt: 'あなたは人事情報 (評価 / 給与) の流出を厳しく審査する人事責任者です。',
  },
  {
    role: 'infosec',
    systemPrompt: 'あなたは資格情報・機密文書の社外流出を検知する情報セキュリティ担当です。',
  },
];

export interface ConsensusResult {
  opinions: SubAgentOpinion[];
  decision: 'allow' | 'deny';
  confidence: number;
}

export interface LLMConsensusOptions {
  profiles?: readonly JudgeProfile[];
  denyThreshold?: number;
}

export class LLMConsensusEngine {
  constructor(
    private readonly llm: LLMAdapter,
    private readonly options: LLMConsensusOptions = {},
  ) {}

  async deliberate(intent: Intent): Promise<ConsensusResult> {
    const profiles = this.options.profiles ?? DEFAULT_JUDGE_PROFILES;
    const threshold = this.options.denyThreshold ?? 0.5;
    const opinions: SubAgentOpinion[] = [];
    for (const profile of profiles) {
      const opinion = await this.llm.judge({
        intent,
        role: profile.role,
        systemPrompt: profile.systemPrompt,
      });
      opinions.push(opinion);
    }
    const denyCount = opinions.filter((o) => o.verdict === 'deny').length;
    const totalVoting = opinions.filter((o) => o.verdict !== 'abstain').length;
    const denyRatio = totalVoting === 0 ? 0 : denyCount / totalVoting;
    const decision: 'allow' | 'deny' = denyRatio >= threshold ? 'deny' : 'allow';

    const weighting = opinions.reduce((acc, o) => {
      if (o.verdict === decision) return acc + o.confidence;
      return acc;
    }, 0);
    const relevant = opinions.filter((o) => o.verdict === decision).length;
    const confidence = relevant === 0 ? 0 : weighting / relevant;

    return { opinions, decision, confidence };
  }
}
