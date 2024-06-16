import { z } from 'zod';

export function recordWithHints<T extends z.ZodTypeAny>(
  schema: T,
  slots: string[] = [],
) {
  if (slots.length) {
    const slotSchemas = Object.fromEntries(
      slots.map(s => [s, schema.optional()]),
    );
    return z.record(schema).and(z.object(slotSchemas));
  } else {
    return z.record(schema);
  }
}
