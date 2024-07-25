import { ProjectMigrator } from './work/index.js';
await new ProjectMigrator({ logger: { level: 'debug' } }).run();
