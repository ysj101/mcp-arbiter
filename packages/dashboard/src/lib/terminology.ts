export const courtTerminology = {
  intent: '申立',
  policy: '憲法',
  rule: '条文',
  charge: '罪状',
  evidence: '証拠',
  verdict: '判決',
  judgment: '判決文',
  precedents: '判例集',
  subAgent: '審理官',
  agent: '被申立人',
  allow: '許可',
  deny: '棄却',
} as const;

export type CourtTerm = keyof typeof courtTerminology;
