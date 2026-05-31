import type { IncomingMessage, ServerResponse } from 'node:http';

/** ルートハンドラの戻り値。status と JSON 化する body を表す。 */
export interface HttpResult {
  status: number;
  body: unknown;
}

/** リクエストボディを読み取り JSON としてパースする。空・不正な場合は null。 */
export async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

/** HttpResult を JSON レスポンスとして書き出す。 */
export function sendJson(res: ServerResponse, result: HttpResult): void {
  res.writeHead(result.status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(result.body));
}
