import { z } from 'zod';


/**
 * We're going to abuse this horribly to represent physical size, size of digital documents,
 * and screen/image resolutions.
 * 
 * When physical items are being discussed:
 * Width x Height x Depth [sizeUom], Weight [weightUom]
 * 
 * For screen and imaging devices:
 * Width x Height x Depth [sizeUom == color depth], Weight [weightUom] = Pixels Per Uom
 * 
 * For digital files:
 * 
 * Width x Height [sizeUom], Weight [weightUom] = Binary File Size
 */
export const SizeSchema = z
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

export type Size = z.infer<typeof SizeSchema>;

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
