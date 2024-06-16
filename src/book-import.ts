import { BookMigrator } from "./books/books.js";

await new BookMigrator({ store: 'arango' }).run();