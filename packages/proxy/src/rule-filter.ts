import type { Evidence, Intent, Policy, PolicyRule } from '@arbiter/shared-types';

export interface RuleMatch {
  policy: Policy;
  rule: PolicyRule;
  evidence: Evidence;
}

export type RuleFilterResult =
  | { decision: 'deny'; matches: RuleMatch[] }
  | { decision: 'pass'; matches: [] };

const resolvePath = (obj: unknown, path: string): unknown => {
  if (!path) return obj;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
};

const matchValue = (actual: unknown, rule: PolicyRule): boolean => {
  const { operator, value } = rule;
  if (actual === undefined || actual === null) return false;
  if (value === undefined) return false;
  const str = typeof actual === 'string' ? actual : JSON.stringify(actual);
  switch (operator) {
    case 'equals':
      return str === value;
    case 'contains':
      return str.toLowerCase().includes(value.toLowerCase());
    case 'startsWith':
      return str.toLowerCase().startsWith(value.toLowerCase());
    case 'matches':
      try {
        return new RegExp(value, 'i').test(str);
      } catch {
        return false;
      }
    default:
      return false;
  }
};

const matchTool = (tool: string, pattern?: string): boolean => {
  if (!pattern) return true;
  if (pattern === '*' || pattern === tool) return true;
  try {
    return new RegExp(`^${pattern.replace(/\*/g, '.*')}$`).test(tool);
  } catch {
    return false;
  }
};

export const evaluateRules = (intent: Intent, policies: readonly Policy[]): RuleFilterResult => {
  const matches: RuleMatch[] = [];
  for (const policy of policies) {
    if (!policy.enabled) continue;
    if (policy.action !== 'deny') continue;
    for (const rule of policy.rules) {
      if (!matchTool(intent.tool, rule.toolPattern)) continue;
      const path = rule.parameterPath ?? '';
      const actual = resolvePath(intent.parameters, path);
      if (matchValue(actual, rule)) {
        matches.push({
          policy,
          rule,
          evidence: {
            location: `parameters.${path || '$'}`,
            excerpt: typeof actual === 'string' ? actual.slice(0, 200) : JSON.stringify(actual),
            ...(policy.sensitiveCategories[0]
              ? { detectedCategory: policy.sensitiveCategories[0] }
              : {}),
          },
        });
      }
    }
  }
  if (matches.length > 0) {
    return { decision: 'deny', matches };
  }
  return { decision: 'pass', matches: [] };
};
