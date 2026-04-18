import type { Policy, Verdict } from '@arbiter/shared-types';

export interface PolicyQuery {
  enabled?: boolean;
}

export interface VerdictQuery {
  agentId?: string;
  decision?: 'allow' | 'deny';
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface StorageAdapter {
  listPolicies(query?: PolicyQuery): Promise<Policy[]>;
  getPolicy(policyId: string): Promise<Policy | undefined>;
  upsertPolicy(policy: Policy): Promise<Policy>;
  deletePolicy(policyId: string): Promise<void>;

  saveVerdict(verdict: Verdict): Promise<Verdict>;
  getVerdict(verdictId: string): Promise<Verdict | undefined>;
  listVerdicts(query?: VerdictQuery): Promise<Verdict[]>;
}

export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly policies = new Map<string, Policy>();
  private readonly verdicts = new Map<string, Verdict>();

  async listPolicies(query?: PolicyQuery): Promise<Policy[]> {
    const all = [...this.policies.values()];
    if (query?.enabled === undefined) return all;
    return all.filter((p) => p.enabled === query.enabled);
  }

  async getPolicy(policyId: string): Promise<Policy | undefined> {
    return this.policies.get(policyId);
  }

  async upsertPolicy(policy: Policy): Promise<Policy> {
    this.policies.set(policy.policyId, policy);
    return policy;
  }

  async deletePolicy(policyId: string): Promise<void> {
    this.policies.delete(policyId);
  }

  async saveVerdict(verdict: Verdict): Promise<Verdict> {
    this.verdicts.set(verdict.verdictId, verdict);
    return verdict;
  }

  async getVerdict(verdictId: string): Promise<Verdict | undefined> {
    return this.verdicts.get(verdictId);
  }

  async listVerdicts(query?: VerdictQuery): Promise<Verdict[]> {
    let list = [...this.verdicts.values()];
    const agentId = query?.agentId;
    const decision = query?.decision;
    const fromDate = query?.fromDate;
    const toDate = query?.toDate;
    if (agentId) list = list.filter((v) => v.agentId === agentId);
    if (decision) list = list.filter((v) => v.decision === decision);
    if (fromDate) list = list.filter((v) => v.createdAt >= fromDate);
    if (toDate) list = list.filter((v) => v.createdAt <= toDate);
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (query?.limit) list = list.slice(0, query.limit);
    return list;
  }
}
