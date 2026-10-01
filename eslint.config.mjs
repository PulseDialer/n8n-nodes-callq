import { config } from '@n8n/node-cli/eslint';

export default [{ ignores: ['**/*.test.ts'] }, ...(Array.isArray(config) ? config : [config])];
