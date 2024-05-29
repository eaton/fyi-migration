import { z } from "zod";

/**
 * Optional todos:
 * 
 * - [ ] Auto-populate slug from title if it doesn't exist
 * - [ ] Auto-populate date from filename if it doesn't exist
 * - [ ] Auto-populate filename from date + slugified title
 * - [ ] Auto-populate ID from ids and type
 */

export const EleventyNavigationSchema = z.object({
  key: z.string().optional(),
  title: z.string().optional(),
  excerpt: z.string().optional(),
  parent: z.string().optional(),
  order: z.number().optional(),
  url: z.string().url().optional(),  
}).describe("Metadata to control Eleventy's nav + breadcrumb plugin.")

export const FrontmatterSchema = z.object({
  id: z.string().optional(), // IDs should follow a format like: `type/unique-key`
  date: z.coerce.date().optional(),

  ids: z.record(z.string()).optional().describe('Additional strings that identify the item. ISBN, Drupal node ID, etc.'),
  dates: z.record(z.coerce.date()).optional().describe('Significant dates for the item. Created, Modified, Published, Copyright, etc.'),

  slug: z.string().optional(),
  permalink: z.string().or(z.boolean()).optional().describe("The internal path of the item on the site; if FALSE no page is generated."),
  url: z.string().url().optional().describe("The item's canonical offsite URL, if one exists."),
  archivedAt: z.string().url().optional().describe("The item's archival URL (usually archive.org)"),

  // Actual content-like metadata
  title: z.string().optional(),
  summary: z.string().optional(),
  headline: z.string().optional(),
  dek: z.string().optional(),
  excerpt: z.string().optional(),
  image: z.string().optional(),

   // We use this instead of 'tags' because 11ty auto-generates collections for 'tags'
  keywords: z.array(z.string()).optional(),

  layout: z.string().optional(),
  published: z.boolean().optional(),
  eleventyNavigation: EleventyNavigationSchema.optional(),

  migration: z.record(z.unknown()).optional(),
  engagement: z.record(z.number().or(z.string())).optional()
}).passthrough();

export const MarkdownPostSchema = z.object({
  file: z.string().optional(),
  data: FrontmatterSchema,
  content: z.string().optional()
});

export type MarkdownPost = z.infer<typeof MarkdownPostSchema>;
