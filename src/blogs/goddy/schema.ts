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
  name: z.string().optional(),
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
});

export const commentBodySchema = fieldSchema.extend({
  comment_body_value: z.string(),
  comment_comment_body_summary: z.string().optional(),
});

export const fileSchema = z.object({
  fid: intString,
  uid: intString,
  filename: z.string().optional(),
  uri: z.string().optional(),
  filemime: z.string().optional(),
  filesize: intString,
  status: z.unknown(),
  timestamp: epochString,
});

export const uploadSchema = fieldSchema.extend({
  upload_fid: z.number(),
  upload_display: z.coerce.boolean(),
  upload_description: z.string().optional(),
  file: fileSchema.optional(),
});

export const linkSchema = fieldSchema.extend({
  field_link_url: z.string().url(),
  field_link_title: z.string(),
  field_link_attributes: serializedPHP.optional(),
});

export const moneyQuoteSchema = fieldSchema.extend({
  field_money_quote_value: z.string(),
  field_money_quote_format: z.string(),
});

export const asinParticipantSchema = z.object({
  asin: z.coerce.string(),
  type: z.string(),
  participant: z.string(),
});

export const asinBookSchema = z.object({
  asin: z.coerce.string(),
  ean: z.coerce.string().optional(),
  isbn: z.coerce.string().optional().optional(),
  deweydecimalnumber: z.coerce.string().optional(),
  edition: z.coerce.string().optional(),
  numberofpages: z.coerce.string().optional(),
  publicationdate: z.coerce.string().optional(),
});

export const asinItemSchema = z.object({
  asin: z.coerce.string(),
  title: z.unknown(),
  detailpageurl: z.unknown(),
  salesrank: z.unknown(),
  brand: z.unknown(),
  publisher: z.unknown(),
  manufacturer: z.unknown(),
  mpn: z.unknown(),
  studio: z.unknown(),
  label: z.unknown(),
  binding: z.unknown(),
  releasedate: z.unknown(),
  listpriceamount: z.unknown(),
  listpricecurrencycode: z.unknown(),
  listpriceformattedprice: z.unknown(),
  productgroup: z.unknown(),
  producttypename: z.unknown(),
  invalid_asin: z.unknown(),
  timestamp: z.unknown(),
  lowestpriceamount: z.unknown(),
  lowestpricecurrencycode: z.unknown(),
  lowestpriceformattedprice: z.unknown(),
  amazonpriceamount: z.unknown(),
  amazonpricecurrencycode: z.unknown(),
  amazonpriceformattedprice: z.unknown(),
  customerreviews_iframe: z.unknown(),
});

export const productSchema = fieldSchema.extend({
  field_product_asin: z.coerce.string(),
  participants: z.array(asinParticipantSchema).optional(),
  item: asinItemSchema.optional(),
  book: asinBookSchema.optional(),
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
});

export const aliasSchema = z.object({
  pid: intString,
  source: z.string(),
  alias: z.string(),
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
  value: serializedPHP,
});

export const goddyNodeSchema = nodeSchema.extend({
  money_quote: moneyQuoteSchema.optional(),
  product: productSchema.optional(),
  link: linkSchema.optional(),
  uploads: z.array(uploadSchema).optional(),
});

export type GoddyNode = z.infer<typeof goddyNodeSchema>;
export type GoddyComment = z.infer<typeof commentSchema>;
