import jetpack from "@eatonfyi/fs-jetpack";
import { Book } from "../../schemas/book.js";

export type BookFetchResult = {
  success: true,
  book: Book
} | {
  success: false,
  error: Error
}

export type BookFetcFunc = (book: Partial<Book>, cache: typeof jetpack) => Promise<BookFetchResult>;