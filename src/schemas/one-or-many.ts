import { z } from 'zod';

export function oneOrMany(schema: z.ZodTypeAny, optional = true) {
  const multi = schema
    .or(z.array(schema))
    .transform(i => (!!i && !Array.isArray(i) ? [i] : i));
  return optional ? multi.optional() : multi;
}
