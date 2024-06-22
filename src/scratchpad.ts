 // import { TalkMigrator } from './work/talks.js';
 // await new TalkMigrator({ logger: { level: 'debug' } }).run();

//import { BookMigrator } from './books/books.js';
//await new BookMigrator({ logger: { level: 'debug' } }).run();

import { LinkedInMigrator } from "./social/linkedin.js";
await new LinkedInMigrator({ logger: { level: 'debug' } }).run();
