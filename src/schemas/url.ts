import { ParsedUrl } from '@eatonfyi/urls';
import { z } from 'zod';

export const urlSchema = z
  .instanceof(URL)
  .or(z.string().url())
  .transform(t => new ParsedUrl(t));
export const urlStringSchema = z
  .instanceof(URL)
  .or(z.string().url())
  .transform(t => t.toString());
