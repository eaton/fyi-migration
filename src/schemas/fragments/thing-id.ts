import { z } from "zod";

export const idSeparator = '.'
export const idPattern = new RegExp(`[\\w@-_]+${idSeparator}[\\w@-_]+`);
export const idSchema = z.coerce.string().regex(idPattern, { message: 'Incorrect ID format.'});
