// Thans to /u/Living_Banana on Reddit, a handy little function to
// do left/right/inner joins with two arrays of objects based on
// specific property matches.
//
// https://www.reddit.com/r/typescript/comments/1cdfnuj/comment/l1c6f5l/

export enum ArrayJoinType {
  LeftJoin,
  InnerJoin,
  RightJoin,
}

/**
 * Takes two arrays of objects; if they're of different types, the two types
 * must have at least one property/key in common.
 *
 * The returned array does not contain any of the original objects; rather,
 * it contains new objects created by merging the objects in the two incoming
 * lists based on the shared key.
 *
 * It's a SQL join. That's it.
 */
export function joinArrays<Type1, Type2>(
  array1: Type1[],
  array2: Type2[],
  key: keyof Type1 & keyof Type2,
  joinType: ArrayJoinType = ArrayJoinType.InnerJoin,
): (Type1 & Type2)[] {
  // Deciding which array to map and which to iterate
  const n = array1.length;
  const m = array2.length;
  const useArray1AsMap =
    joinType === ArrayJoinType.RightJoin ||
    (joinType === ArrayJoinType.InnerJoin && n >= m);
  const mapTarget = (useArray1AsMap ? array1 : array2) as (Type1 | Type2)[];
  const arrayTarget = (useArray1AsMap ? array2 : array1) as (Type1 | Type2)[];

  // Mapping the array to a map for faster access on the key
  const map = new Map<typeof key, typeof mapTarget>();
  mapTarget.forEach(item => {
    const k = item[key] as typeof key;
    if (!map.has(k)) {
      map.set(k, []);
    }
    map.get(k)!.push(item);
  });

  // Merging the arrays
  return arrayTarget.flatMap(item => {
    const values = map.get(item[key] as typeof key);

    if (values) {
      // In case of a match in the other array, we merge the lines
      return values.map(value => ({ ...item, ...value })) as (Type1 & Type2)[];
    } else {
      // In case of no match, it depends on the merge type
      if (joinType === ArrayJoinType.InnerJoin) {
        return [];
      } else {
        return [{ ...(<Type1>{}), ...(<Type2>{}), ...item }];
      }
    }
  });
}
