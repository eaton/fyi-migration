# Storage vs Schema

The `schema` directory is concerned with parsing, validating, and enforcing rules for roughly Schema.org equivalent data. It might not be exactly Schema.org, but it's easily translatable.

The 'storage' directory is for mapping the distinct kinds of things I care about (which could be any number of schema.org types) to the different ways I can/may store them. Right now, there are four primary outputs:

1. Markdown and JSON for 11ty
2. ndjson files for each distinct type
3. ArangoDB for loose graph hijinks
4. Postgres to experiment with combination graph/vector stuff via pgvector and apache age

The current generation of my eaton.fyi site is leaning heavily on item 1: markdown files and JSON for small piles of structured data. It's a temporary shim, though, as my real goal is to get a nice API rolling and generate the same stuff from a dynamic source at build-time.

In the short term though, I'm generating files during the dev process for each migrator, then pushing to arnangodb when it's ironed out. I'm doing more of the de-duplication and bulk processing work in arango where superior querying capabilities make a bunch of stuff easier, then using that to OUTPUT the markdown and data files for 11ty.

Which is to say storages will come and go but hte schema, hopefully, will endure
