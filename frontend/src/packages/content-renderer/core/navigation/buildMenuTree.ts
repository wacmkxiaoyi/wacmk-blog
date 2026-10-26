export function buildMenuTree(items) {
  const root = [];
  const stack = [];

  items.forEach((sourceItem) => {
    const item = { ...sourceItem, children: [] };

    while (stack.length && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    if (!stack.length) {
      root.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }

    stack.push(item);
  });

  return root;
}
