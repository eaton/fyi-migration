import { GuestBlogMigrator } from './blogs/guestblogs.js';
await new GuestBlogMigrator({ logger: { level: 'debug' } }).run();
