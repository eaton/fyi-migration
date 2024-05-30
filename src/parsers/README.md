# Parser Collection

This is a grab bag of semi-reusable file type parsers that don't belong to a single, specific import. Generally speaking, each one is an exported module with a parse function, an Options interface, and a set of type definitions for each important bit of data returned by the parse function.

## Disqus

Takes a string or buffer containing a raw Disqus XML export, returns all of the account's categories, threads, and posts. By default, it will also:

- Discard deleted posts and spam posts
- Copy thread/category metadata to each post so they can be used in isolation
- Generate a 'sortable key' for each post, reflecting its position in a hierarchical discussion thread.
- Hierarchicalize the data, grouping posts under their thread, threads under their categories.
- Sort threads by their creation date and posts by their 'sortable key'.

## MDB

Accepts the path of an MS Access database and returns a data structure containing its metadata, tables, and table rows. Optionally, you can pass in:

- A list of tables to ignore (supports glob-style wildcards)
- A dictionary keyed by table name, with a Zod schema that will be used to parse and validate each row.
- A boolean to indicate whether rows failing Zod validation should be discarded, or throw errors.
