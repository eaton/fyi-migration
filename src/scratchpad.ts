import { AllBookmarksMigrator } from "./bookmarks/all-bookmarks.js";
import { PostMigrationCleanup } from "./post-migration-cleanup.js";

await new AllBookmarksMigrator({ logger: { level: 'debug' } }).run();
await new PostMigrationCleanup({ logger: { level: 'debug' } }).run();