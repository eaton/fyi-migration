import { CreativeWorkSchema, PersonSchema, SocialMediaPostingSchema } from "./schemas/index.js";
import { ArangoDB } from "./shared/arango.js";

const book = SocialMediaPostingSchema.parse({
  id: 'book.foo',
  type: 'Book',
  name: 'Something Interesting: A Novel',
});

const movie = CreativeWorkSchema.parse({
  id: 'movie.foo',
  type: 'Movie',
  name: 'Something Interesting: The Movie',
});


const me = PersonSchema.parse({
  id: 'person.me',
  name: 'Jeff Eaton',
});


const a = new ArangoDB();
await a.initialize();
await a.reset(() => Promise.resolve(true));

await a.set(book);
await a.set(me);
await a.link(book, me, 'author');
await a.link(movie, book, 'isBasedOn');
