import type { Policy, Verdict } from '@arbiter/shared-types';
import { type Container, CosmosClient } from '@azure/cosmos';
import type { PolicyQuery, StorageAdapter, VerdictQuery } from './storage-adapter.js';

export interface CosmosStorageOptions {
  endpoint: string;
  key: string;
  databaseId: string;
  policiesContainer?: string;
  verdictsContainer?: string;
}

const defaultPoliciesContainer = 'policies';
const defaultVerdictsContainer = 'verdicts';

export class CosmosStorageAdapter implements StorageAdapter {
  private readonly client: CosmosClient;
  private policies?: Container;
  private verdicts?: Container;

  constructor(private readonly options: CosmosStorageOptions) {
    this.client = new CosmosClient({
      endpoint: options.endpoint,
      key: options.key,
    });
  }

  async init(): Promise<void> {
    const { database } = await this.client.databases.createIfNotExists({
      id: this.options.databaseId,
    });
    const { container: p } = await database.containers.createIfNotExists({
      id: this.options.policiesContainer ?? defaultPoliciesContainer,
      partitionKey: { paths: ['/policyId'] },
    });
    const { container: v } = await database.containers.createIfNotExists({
      id: this.options.verdictsContainer ?? defaultVerdictsContainer,
      partitionKey: { paths: ['/agentId'] },
      indexingPolicy: {
        indexingMode: 'consistent',
        includedPaths: [{ path: '/*' }],
        compositeIndexes: [
          [
            { path: '/agentId', order: 'ascending' },
            { path: '/createdAt', order: 'descending' },
          ],
        ],
      },
    });
    this.policies = p;
    this.verdicts = v;
  }

  private ensurePolicies(): Container {
    if (!this.policies) throw new Error('CosmosStorageAdapter.init() was not called');
    return this.policies;
  }

  private ensureVerdicts(): Container {
    if (!this.verdicts) throw new Error('CosmosStorageAdapter.init() was not called');
    return this.verdicts;
  }

  async listPolicies(query?: PolicyQuery): Promise<Policy[]> {
    const container = this.ensurePolicies();
    const params: { name: string; value: string | number | boolean | null }[] = [];
    let sql = 'SELECT * FROM c';
    if (query?.enabled !== undefined) {
      sql += ' WHERE c.enabled = @enabled';
      params.push({ name: '@enabled', value: query.enabled });
    }
    const { resources } = await container.items
      .query<Policy>({ query: sql, parameters: params })
      .fetchAll();
    return resources;
  }

  async getPolicy(policyId: string): Promise<Policy | undefined> {
    const container = this.ensurePolicies();
    try {
      const { resource } = await container.item(policyId, policyId).read<Policy>();
      return resource ?? undefined;
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 404) return undefined;
      throw err;
    }
  }

  async upsertPolicy(policy: Policy): Promise<Policy> {
    const container = this.ensurePolicies();
    const { resource } = await container.items.upsert<Policy>(policy);
    return (resource as Policy | undefined) ?? policy;
  }

  async deletePolicy(policyId: string): Promise<void> {
    const container = this.ensurePolicies();
    try {
      await container.item(policyId, policyId).delete();
    } catch (err: unknown) {
      if ((err as { code?: number }).code !== 404) throw err;
    }
  }

  async saveVerdict(verdict: Verdict): Promise<Verdict> {
    const container = this.ensureVerdicts();
    const { resource } = await container.items.create<Verdict>(verdict);
    return (resource as Verdict | undefined) ?? verdict;
  }

  async getVerdict(verdictId: string): Promise<Verdict | undefined> {
    const container = this.ensureVerdicts();
    const { resources } = await container.items
      .query<Verdict>({
        query: 'SELECT * FROM c WHERE c.verdictId = @id',
        parameters: [{ name: '@id', value: verdictId }],
      })
      .fetchAll();
    return resources[0];
  }

  async listVerdicts(query?: VerdictQuery): Promise<Verdict[]> {
    const container = this.ensureVerdicts();
    const conditions: string[] = [];
    const params: { name: string; value: string | number | boolean | null }[] = [];
    if (query?.agentId) {
      conditions.push('c.agentId = @agentId');
      params.push({ name: '@agentId', value: query.agentId });
    }
    if (query?.decision) {
      conditions.push('c.decision = @decision');
      params.push({ name: '@decision', value: query.decision });
    }
    if (query?.fromDate) {
      conditions.push('c.createdAt >= @fromDate');
      params.push({ name: '@fromDate', value: query.fromDate });
    }
    if (query?.toDate) {
      conditions.push('c.createdAt <= @toDate');
      params.push({ name: '@toDate', value: query.toDate });
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const top = query?.limit ? ` OFFSET 0 LIMIT ${Math.max(1, query.limit)}` : '';
    const sql = `SELECT * FROM c${where} ORDER BY c.createdAt DESC${top}`;
    const { resources } = await container.items
      .query<Verdict>({ query: sql, parameters: params })
      .fetchAll();
    return resources;
  }
}
