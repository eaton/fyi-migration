import { TalkMigrator } from './work/talks.js';
await new TalkMigrator({ logger: { level: 'debug' } }).run();

//import { BookMigrator } from './books/books.js';
//await new BookMigrator({ logger: { level: 'debug' } }).run();

// import { AllDatasetsMigrator } from "./datasets/all-datasets.js";
// await new AllDatasetsMigrator({ logger: { level: 'debug' }}).run();