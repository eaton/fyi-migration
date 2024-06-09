import 'dotenv/config';
import { z } from 'zod';
import { fetchGoogleSheet } from './util/fetch-google-sheet.js';

const schema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.coerce.date().optional(),
  sessionUrl: z.string().optional(),
  keynoteFile: z.string().optional(),
  featuredVersion: z.coerce.boolean().default(false),
  event: z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    dates: z.object({
      start: z.coerce.date().optional(),
      end: z.coerce.date().optional(),
    }).optional()
  }).optional()
});

const data = await fetchGoogleSheet(process.env.GOOGLE_SHEET_ID!, 'talks', schema);
console.log(data);