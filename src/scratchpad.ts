import { LivejournalMigrator } from './blogs/index.js';
await new LivejournalMigrator({ logger: { level: 'debug' } }).run();
