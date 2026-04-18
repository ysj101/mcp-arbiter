export interface EmailSendInput {
  to: string;
  subject: string;
  body: string;
}

export interface RecordedEmail extends EmailSendInput {
  recordedAt: string;
}

export class DummyEmailStore {
  private readonly records: RecordedEmail[] = [];

  record(input: EmailSendInput): RecordedEmail {
    const recorded: RecordedEmail = { ...input, recordedAt: new Date().toISOString() };
    this.records.push(recorded);
    return recorded;
  }

  list(): readonly RecordedEmail[] {
    return [...this.records];
  }

  clear(): void {
    this.records.length = 0;
  }

  size(): number {
    return this.records.length;
  }
}
