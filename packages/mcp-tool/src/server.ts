#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { DummyEmailStore } from './email-store.js';
import { SEND_EMAIL_TOOL, validateSendEmailInput } from './tool-definition.js';

const store = new DummyEmailStore();

const server = new Server(
  { name: 'dummy-email-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [SEND_EMAIL_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== SEND_EMAIL_TOOL.name) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }
  const input = validateSendEmailInput(request.params.arguments);
  const recorded = store.record(input);
  process.stdout.write(
    `[dummy-email] ${recorded.recordedAt} to=${recorded.to} subject="${recorded.subject}"\n`,
  );
  return {
    content: [
      {
        type: 'text',
        text: `queued (dummy). to=${recorded.to} subject="${recorded.subject}"`,
      },
    ],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
