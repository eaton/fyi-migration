import { MailboxMigrator } from './mailboxes.js';

await new MailboxMigrator({ logger: { level: 'debug' } }).run();
