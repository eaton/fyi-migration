import { z } from 'zod';

export function oneOrMany<T extends z.ZodTypeAny>(schema: T, expand = false) {
  return schema
    .or(z.array(schema))
    .transform(i =>
      expand ? (i !== undefined && Array.isArray(i) ? i : [i]) : i,
    );
}
