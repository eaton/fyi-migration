import { z } from 'zod';

export const DimensionsSchema = z
  .string()
  .or(
    z.object({
      width: z.coerce.number().optional(),
      height: z.coerce.number().optional(),
      depth: z.coerce.number().optional(),
      weight: z.coerce.number().optional(),
      sizeUom: z.string().optional(),
      weightUom: z.string().optional(),
    }),
  )
  .transform(d => (typeof d === 'string' ? parseStringDimensions(d) : d));

export type Dimensions = z.infer<typeof DimensionsSchema>;

// TODO
function parseStringDimensions(input: string) {
  const output = {
    width: undefined as number | undefined,
    height: undefined as number | undefined,
    depth: undefined as number | undefined,
    weight: undefined as number | undefined,
    sizeUom: undefined as string | undefined,
    weightUom: undefined as string | undefined,
    raw: input,
  };

  const [width, height, depth] = output.raw.split(/[x⨯×]/g).map(s => s.trim());
  if (width) output.width = Number.parseFloat(width);
  if (height) output.height = Number.parseFloat(height);
  if (depth) output.depth = Number.parseFloat(depth);
  return output;
}
