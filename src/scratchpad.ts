import { GuestBlogMigrator } from './blogs/guest-blogs.js';
await new GuestBlogMigrator({ logger: { level: 'debug' } }).run();
