let idCounter = 0;

export function createStableId(prefix = "content") {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}
