import { z } from 'zod';

export const authorSchema = z.object({
  author_id: z.number(),
  author_name: z.string(),
  author_nickname: z.string(),
  author_email: z.string(),
  author_url: z.string(),
});

export const commentSchema = z.object({
  comment_id: z.number(),
  comment_blog_id: z.number(),
  comment_entry_id: z.number(),
  comment_ip: z.string(),
  comment_author: z.string(),
  comment_email: z.string(),
  comment_url: z.string(),
  comment_visible: z.coerce.boolean(),
  comment_text: z.string(),
  comment_created_on: z.coerce.date(),
});

export const entrySchema = z.object({
  entry_id: z.number(),
  entry_blog_id: z.number(),
  entry_status: z.number(),
  entry_author_id: z.number(),
  entry_convert_breaks: z.coerce.boolean(),
  entry_category_id: z
    .string()
    .optional()
    .transform(s =>
      s === 'NULL' || s === undefined ? undefined : Number.parseInt(s),
    ),
  entry_title: z.string(),
  entry_excerpt: z.string(),
  entry_text: z.string(),
  entry_text_more: z.string(),
  entry_keywords: z
    .string()
    .optional()
    .transform(s => (s === 'NULL' ? undefined : s)),
  entry_created_on: z.coerce.date(),
  entry_modified_on: z.coerce.date(),
  entry_basename: z.string(),
  comments: z.array(commentSchema).optional(),
});

export const categorySchema = z.object({
  category_id: z.number(),
  category_blog_id: z.number(),
  category_label: z.string(),
  category_description: z.string(),
  category_author_id: z.number(),
  category_parent: z.number(),
});

export const blogSchema = z.object({
  blog_id: z.number(),
  blog_shortname: z.string().optional(),
  blog_name: z.string(),
  blog_description: z.string(),
  blog_site_path: z.string(),
  blog_site_url: z.string(),
  blog_convert_paras: z.string(),
  categories: z.array(categorySchema).optional(),
  entries: z.array(entrySchema).optional(),
});

export const pluginSchema = z.object({
  plugindata_id: z.number(),
  plugindata_plugin: z.string(),
  plugindata_key: z.coerce.string(),
  plugindata_data: z.string(),
});

export type Author = z.infer<typeof authorSchema>;
export type Blog = z.infer<typeof blogSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Comment = z.infer<typeof commentSchema>;
export type Plugin = z.infer<typeof pluginSchema>;
