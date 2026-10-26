export function flattenMenuTree(items) {
  return items.reduce((acc, item) => {
    acc.push(item);
    if (item.children?.length) {
      acc.push(...flattenMenuTree(item.children));
    }
    return acc;
  }, []);
}
