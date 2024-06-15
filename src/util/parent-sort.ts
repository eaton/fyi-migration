export type ParentSortableItem = {
  id: string;
  parent?: string;
  thread?: string;
};

/**
 * Given any items with `id`, `parent`, and `thread`, properties, build thread-sensitive
 * sort properties that keep you from having to rebuild the whole tree every time.
 * 
 * Note that the top-level comments in the thread will remain in the same overall order
 * they were sorted in when the function is called; only the sort order of child items
 * is changed. So: sort the in the 'correct' order (by date, popularity, etc) then pass
 * them into this function to be thread-ified.
 * 
 * @see {@link https://git.drupalcode.org/project/drupal/-/blob/11.x/core/modules/comment/src/Entity/Comment.php | Drupal's comment module } 
 */
export function sortByParents(items: ParentSortableItem[]) {
  const dlm = '/';
  const eor = '.';

  for (const c of items.sort(compareThread)) {
    populateThreadForItem(c);
  }
  
  return items.sort(compareThread);

  function populateThreadForItem(c: ParentSortableItem) {
    let thread = c.thread;
    let max: string | undefined = undefined;
    let parts = [];
    let n: number | undefined = undefined;
    let prefix = '';

    if (thread === undefined) {
      if (c.parent === undefined) {
        // This is a comment with no parent comment (depth 0): we start
        // by retrieving the maximum thread level.
        max = stripEor(getMaxThread());
        parts = max?.split(dlm) ?? [];
        n = max ? Number.parseInt(parts[0], 36) : 0;
        prefix = '';

      } else {
        // This is a comment with a parent comment, so grab its parent's
        // thread calue to use as a prefix, then increment the largest existing
        // sibling thread.

        // Get the parent comment:
        const parent = items.find(i => i.id == c.parent);
      
        // If the parent hasn't been handle yet, handle it.
        populateThreadForItem(parent!);

        prefix = stripEor(getThread(parent!)) + dlm;

        // Get the max value in *this* thread.
        max = stripEor(getMaxThreadPerThread(c.parent));

        if (max === undefined) {
          // First child of this parent. As the other two cases do an
          // increment of the thread number before creating the thread
          // string set this to 0 so it requires an increment too.
          n = 0;
        }
        else {
          // Strip the "/" at the end of the thread.
          max = stripEor(max);

          // Get the value at the correct depth.
          parts = max?.split(dlm) ?? [];

          const parent_depth = (parts ?? []).length;
          n = Number.parseInt(parts[parent_depth-1], 36);
        }
      }

      thread = prefix + (++n).toString(36).padStart(2, '0') + eor;
      setThread(c, thread);
    }
  }
  
  function stripEor(thread?: string) {
    if (thread && thread.endsWith(eor)) {
      return thread.slice(0, -1);
    }
    return thread;
  }

  function setThread(node: ParentSortableItem, value?: string) {
    node.thread = value;
  }

  function getThread(node: ParentSortableItem) {
    return node.thread;
  }

  /*
   * The maximum encoded thread value among the top level comments of the
   * node $comment belongs to. NULL is returned when the commented entity has
   * no comments.
   */
  function getMaxThread() {
    return items.filter(t => !!t.thread).toSorted(compareThread).pop()?.thread;
  }

  /*
   * The maximum encoded thread value among all replies of $comment. NULL is
   * returned when the commented entity has no comments.
   */
  function getMaxThreadPerThread(id: string) {
    const justChildren = items.filter(i => i.parent === id && !!i.thread).toSorted(compareThread);
    return justChildren.pop()?.thread
  }
  
  function compareThread(a: ParentSortableItem, b: ParentSortableItem) {
    if (a.thread !== undefined && b.thread !== undefined) {
      return a.thread.localeCompare(b.thread)
    } else {
      return 0;
    }
  }
}


/**
 * Return a simple string representation of the item tree
 */
export function formatThread(items: ParentSortableItem[]) {
  const indented = items.map(i => '  '.repeat((i.thread?.split('/')?.length ?? 1) - 1) + ' - item ' + i.id.toString());
  return indented.join('\n')
}