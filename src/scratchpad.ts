import { OpmlMigrator } from "./bookmarks/opml.js";

await new OpmlMigrator({
  input: 'input/blogs/movabletype',
  name: 'positiva-mt',
  date: new Date(2005, 2, 29),
}).run();
