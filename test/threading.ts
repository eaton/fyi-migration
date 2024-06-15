import test from 'ava';
import { ParentSortableItem, sortByParents } from '../src/util/parent-sort.js'

test('sort threaded comments', t => {
  const comments: ParentSortableItem[] = [
    { id: 'a' },
    { id: 'b' },
    { id: 'c' },
    { id: 'd', parent: 'b' },
    { id: 'e', parent: 'b' },
    { id: 'f', parent: 'd' },
    { id: 'g', parent: 'b' },
    { id: 'h', parent: 'a' },
    { id: 'i', parent: 'h' },
    { id: 'j', parent: 'h' },
  ];

  const sorted = sortByParents(comments);
  t.is(sorted.length, comments.length);

  // 'a' should come first, because that's the order we passed things in.
  // 'h' should come second, as it's a's first child.
  // 'c' should come last, as the others are descendants of 'b'
  t.is(sorted[0].id, 'a');
  t.is(sorted[1].id, 'h');
  t.is(sorted.pop()?.id, 'c');
});



test('top-level threads respect initial order', t => {
  const comments: ParentSortableItem[] = [
    { id: 'b' },
    { id: 'c' },
    { id: 'a' },
    { id: 'd', parent: 'b' },
    { id: 'e', parent: 'b' },
    { id: 'f', parent: 'd' },
    { id: 'g', parent: 'b' },
    { id: 'h', parent: 'a' },
    { id: 'i', parent: 'h' },
    { id: 'j', parent: 'h' },
  ];

  const sorted = sortByParents(comments);
  t.is(sorted.length, comments.length);

  t.is(sorted[0].id, 'b');
  t.is(sorted[1].id, 'd');
});

test('sort in place', t => {
  const comments: ParentSortableItem[] = [
    { id: 'b' },
    { id: 'c' },
    { id: 'a' },
    { id: 'd', parent: 'b' },
    { id: 'e', parent: 'b' },
    { id: 'f', parent: 'd' },
    { id: 'g', parent: 'b' },
    { id: 'h', parent: 'a' },
    { id: 'i', parent: 'h' },
    { id: 'j', parent: 'h' },
  ];

  sortByParents(comments);
  t.is(comments.length, comments.length);

  t.is(comments[0].id, 'b');
  t.is(comments[1].id, 'd');
});