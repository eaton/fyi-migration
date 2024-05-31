import { z } from 'zod';
import { Php } from '@eatonfyi/serializers';

const epochString = z.number().or(z.string())
.transform(v => typeof v === 'string' ? Number.parseInt(v.replaceAll(/[^\d]/g, '')) : v)
.transform(n => n ? new Date(n * 1000) : undefined)
  .optional();

const intString = z.number().or(z.string())
  .transform(v => typeof v === 'string' ? Number.parseInt(v.replaceAll(/[^\d]/g, '')) : v);

const serializedPHP = z.string().transform(s => {
  const php = new Php();
  try {
    return php.parse(s);
  } catch {
    return undefined;
  }
});

export const commentSchema = z.object({
  cid: intString,
  pid: intString.optional(),
  nid: intString,
  uid: intString,
  thread: z.string(),
  status: z.number(),
  spam: z.unknown(),

  name: z.string().optional(),
  mail: z.string().optional(),
  hostname: z.string().optional(),
  homepage: z.string().optional(),

  timestamp: epochString,
  subject: z.string().optional(),
  comment: z.string().optional()
});

export const fileSchema = z.object({
  nid: intString,
  vid: intString,
  filepath: z.string(),
  filename: z.string(),
  filemime: z.string(),
  filesize: intString,
  description: z.string().optional(),
});

export const quoteSchema = z.object({
  nid: z.number(),
  author: z.string().optional(),
});

export const photoSchema = z.object({
  nid: z.number(),
  vid: z.number(),
  field_flickr_link_url: z.string(),
  field_photoset_url: z.string().optional(),
  field_photoset_title: z.string().optional(),
});

export const linkSchema = z.object({
  nid: z.number(),
  title: z.string().optional(),
  url: z.string().optional()
});

export const amazonSchema = z.object({
  nid: z.number(),
  asin: z.coerce.string().optional(),
});

export const nodeSchema = z.object({
  nid: intString,
  vid: intString,
  type: z.string(),
  title: z.string(),
  uid: intString,
  status: z.number(),
  created: epochString,
  changed: epochString,
  comment: z.number(),
  promote: z.coerce.boolean(),
  sticky: z.coerce.boolean(),
  body: z.string().optional(),
});

export const aliasSchema = z.object({
  pid: intString,
  src: z.string(),
  dst: z.string(),
  language: z.string(),
});

export const userSchema = z.object({
  uid: intString,
  name: z.string(),
  mail: z.string().optional(),
  theme: z.string(),
  signature: z.string(),
  created: epochString,
  access: epochString,
  login: epochString,
  status: z.number(),
  picture: z.unknown(),
  data: serializedPHP.nullish(),
});

export const variableSchema = z.object({
  name: z.string(),
  value: serializedPHP
});

export const positivaNodeSchema = nodeSchema.and(z.object({
  link: linkSchema.optional(),
  quote: quoteSchema.optional(),
  photo: photoSchema.optional(),
  amazon: amazonSchema.optional(),
  files: z.array(fileSchema).optional(),
}))

export type Node = z.infer<typeof positivaNodeSchema>;
export type Comment = z.infer<typeof commentSchema>;