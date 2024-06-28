//import { BookMigrator } from './books/books.js';
//await new BookMigrator({ logger: { level: 'debug' } }).run();

// import { AllDatasetsMigrator } from "./datasets/all-datasets.js";
// await new AllDatasetsMigrator({ logger: { level: 'debug' }}).run();


import { index, pgTable, serial, text, vector } from 'drizzle-orm/pg-core';

export const guides = pgTable(
  'guides',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    url: text('url').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
  },
  (table) => ({
    embeddingIndex: index('embeddingIndex').using('hnsw', table.embedding.op('vector_cosine_ops')),
  }),
);
