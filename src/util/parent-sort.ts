export type ParentSortableItem<T = number> = {
  id: T;
  parent?: T;
  sort?: string;
};

type SortNode<T = number> = {
  id: T;
  parent?: T;
  sort?: string;
  children: Map<T, SortNode<T>>;
};

export function sortByParents<T = number>(items: ParentSortableItem<T>[]) {
  const all = items.map(
    i =>
      ({
        id: i.id,
        parent: i.parent,
        sort: undefined,
        children: new Map<T, SortNode<T>>(),
      }) as SortNode<T>,
  );
  const root = new Map<T, SortNode<T>>();
  const flat = new Map<T, SortNode<T>>(
    Object.fromEntries(items.map(i => [i.id, i])),
  );

  for (const i of all) {
    if (i.parent === undefined) root.set(i.id, i);
    flat.get(i.id)?.children.set(i.id, i);
  }
}
