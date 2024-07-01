import { schemer } from "./shared/index.js";
import { SocialMediaPostingSchema } from "./schemas/index.js";

const cw = SocialMediaPostingSchema.parse({
  id: 'foo',
  type: 'SocialMediaThread',
  name: 'Some twitter thread',
});

console.log({
  collection: schemer.getCollection(cw),
  type: schemer.getType(cw),
  key: schemer.getId(cw),
  schema: schemer.getSchema(cw)
});