import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { createGenogramMcpServer } from './create-server';

serveStdio(() => createGenogramMcpServer());
