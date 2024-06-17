import { BookMigrator } from "./books/books.js";
await new BookMigrator({ logger: { level: 'debug' } }).run();