import { canParse, ParsedUrl } from '@eatonfyi/urls';
import { z } from 'zod';

export const urlSchema = z
  .instanceof(URL)
  .or(z.string())
  .transform(t => (t && canParse(t.toString()) ? new ParsedUrl(t) : undefined));

export const urlStringSchema = z
  .instanceof(URL)
  .or(z.string().url())
  .transform(t => t.toString());
