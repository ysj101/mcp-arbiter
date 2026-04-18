import type { EmailSendInput } from './email-store.js';

export const SEND_EMAIL_TOOL = {
  name: 'send_email',
  description: 'ダミーメール送信。実送信は行わず標準出力に記録のみ行う。',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: '宛先メールアドレス' },
      subject: { type: 'string', description: '件名' },
      body: { type: 'string', description: '本文' },
    },
    required: ['to', 'subject', 'body'],
    additionalProperties: false,
  },
} as const;

export const validateSendEmailInput = (raw: unknown): EmailSendInput => {
  if (!raw || typeof raw !== 'object') throw new Error('send_email: arguments must be an object');
  const obj = raw as Record<string, unknown>;
  const to = obj.to;
  const subject = obj.subject;
  const body = obj.body;
  if (typeof to !== 'string' || !to) throw new Error('send_email: "to" must be a non-empty string');
  if (typeof subject !== 'string') throw new Error('send_email: "subject" must be a string');
  if (typeof body !== 'string') throw new Error('send_email: "body" must be a string');
  return { to, subject, body };
};
