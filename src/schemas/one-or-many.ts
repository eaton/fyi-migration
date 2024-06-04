import { z } from 'zod';

type Options = {
  optional?: boolean,
  expand?: boolean,
}

export function oneOrMany<T extends z.ZodTypeAny>(schema: T, options: Options = {}) {
  const opt = { optional: true, expand: true, ...options }
  const multi = schema
    .or(z.array(schema))
    .transform(i => opt.expand ? ((i !== undefined && Array.isArray(i)) ? i : [i]) : i);
  return opt.optional ? multi.optional() : multi;
}
