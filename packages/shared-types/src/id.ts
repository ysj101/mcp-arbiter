/**
 * Arbiter 内で利用する識別子（intentId / verdictId / policyId 等）を生成する。
 * `${prefix}-${timestamp}-${random}` 形式で、prefix により種別を判別できるようにする。
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
