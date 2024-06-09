import { z } from 'zod';

/**
 * Given a Zod schema, returns a parser function that operates in "strict" or "lenient" mode;
 * either failing with a thrown error when the input fails to parse, or silently returning
 * an `undefined` value.
 */
export function makeSchemaParser<T extends z.ZodTypeAny>(
  schema: T,
): (input: unknown) => z.infer<T>;
export function makeSchemaParser<T extends z.ZodTypeAny>(
  schema: T,
  strict = true,
): (input: unknown) => z.infer<T> | undefined {
  if (strict) {
    return (input: unknown) => schema.parse(input);
  } else {
    return (input: unknown) => {
      return schema.safeParse(input).data ?? undefined;
    };
  }
}
