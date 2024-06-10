import { z } from 'zod';

export function oneOrMany<T extends z.ZodTypeAny>(schema: T, expand = false) {
  return schema
    .or(z.array(schema))
    .transform(i =>
      expand ? (i !== undefined && Array.isArray(i) ? i : [i]) : i,
    );
}

export function recordWithHints<T extends z.ZodTypeAny>(
  schema: T,
  slots: string[] = [],
) {
  if (slots.length) {
    const slotSchemas = Object.fromEntries(
      slots.map(s => [s, schema]),
    );
    return z.record(schema).and(z.object(slotSchemas));
  } else {
    return z.record(schema);
  }
}
