import { z } from "zod";

export const TalkSchema = z.object({});
export type Talk = z.infer<typeof TalkSchema>;
