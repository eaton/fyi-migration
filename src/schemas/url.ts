import { z } from 'zod';
import { ParsedUrl } from "@eatonfyi/urls";

export const urlSchema = z.instanceof(URL).or(z.string().url()).transform(t => new ParsedUrl(t));
export const urlStringSchema = z.instanceof(URL).or(z.string().url()).transform(t => t.toString());
