import { PostMigrationCleanup } from './post-migration-cleanup.js';

await new PostMigrationCleanup({ logger: { level: 'debug' } }).run();
