 import { TalkMigrator } from './work/talks.js';
 await new TalkMigrator({ logger: { level: 'debug' } }).run();


//import { BookMigrator } from './books/books.js';
//await new BookMigrator({ logger: { level: 'debug' } }).run();
