import { ProjectMigrator } from './work/projects.js';
await new ProjectMigrator({ logger: { level: 'debug' } }).run();
