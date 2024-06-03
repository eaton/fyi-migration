import { Php } from '@eatonfyi/serializers';
import { z } from 'zod';

const epochString = z
  .number()
  .or(z.string())
  .transform(v =>
    typeof v === 'string' ? Number.parseInt(v.replaceAll(/[^\d]/g, '')) : v,
  )
  .transform(n => (n ? new Date(n * 1000) : undefined))
  .optional();

const intString = z
  .number()
  .or(z.string())
  .transform(v =>
    typeof v === 'string' ? Number.parseInt(v.replaceAll(/[^\d]/g, '')) : v,
  );

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
  subject: z.string().optional(),
  hostname: z.string().optional(),
  created: epochString,
  changed: epochString,
  status: z.number(),
  thread: z.string(),
  name: z.coerce.string().optional(),
  mail: z.string().optional(),
  homepage: z.string().optional(),
  body: z.string().optional(),
});

export const fieldSchema = z.object({
  entity_type: z.string(),
  bundle: z.string(),
  deleted: z.coerce.boolean(),
  entity_id: intString,
  revision_id: intString,
  language: z.string(),
  delta: z.number(),
});

export const bodySchema = fieldSchema.extend({
  body_value: z.string(),
  body_summary: z.string().optional(),
  body_format: z.string(),
});

export const commentBodySchema = fieldSchema.extend({
  comment_body_value: z.string(),
  comment_comment_body_summary: z.string().optional(),
  comment_body_format: z.string(),
});

export const fileSchema = z.object({
  fid: intString,
  uid: intString,
  filename: z.unknown(),
  uri: z.unknown(),
  filemime: z.unknown(),
  filesize: intString,
  status: z.unknown(),
  timestamp: epochString,
});

export const attachmentSchema = fieldSchema.extend({
  field_attachments_fid: z.number(),
  field_attachments_display: z.coerce.boolean(),
  field_attachments_description: z.string().optional(),
  file: fileSchema.optional(),
});

export const nodeSchema = z.object({
  nid: intString,
  vid: intString,
  type: z.string(),
  language: z.string(),
  title: z.string(),
  uid: intString,
  status: z.number(),
  created: epochString,
  changed: epochString,
  comment: z.number(),
  promote: z.coerce.boolean(),
  sticky: z.coerce.boolean(),
  body: z.string().optional(),
  summary: z.string().optional(),
  attachments: z.array(attachmentSchema).optional(),
});

export const aliasSchema = z.object({
  pid: intString,
  source: z.string(),
  alias: z.string(),
  language: z.string(),
});

export const userSchema = z.object({
  uid: intString,
  name: z.coerce.string(),
  mail: z.string().email(),
  theme: z.string(),
  signature: z.string(),
  created: epochString,
  access: epochString,
  login: epochString,
  status: z.number(),
  picture: z.unknown(),
  data: serializedPHP,
});

export const variableSchema = z.object({
  name: z.coerce.string(),
  value: serializedPHP,
});
