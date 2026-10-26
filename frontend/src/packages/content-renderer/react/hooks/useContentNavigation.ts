import { useEffect, useMemo, useState } from "react";
import { createContentNavigation } from "../../core";
import { navigateToContentHeading, observeActiveHeading } from "../navigation";

export function useContentNavigation({
  document,
  minLevel,
  maxLevel,
  includeUntitled,
  tree,
  filter,
  root,
  offsetTop = 0,
  observeActive = false,
  rootMargin,
  threshold,
  navigateOptions,
}) {
  const [activeId, setActiveId] = useState(null);

  const navigation = useMemo(
    () =>
      createContentNavigation(document, {
        minLevel,
        maxLevel,
        includeUntitled,
        tree,
        filter,
      }),
    [document, minLevel, maxLevel, includeUntitled, tree, filter],
  );

  useEffect(() => {
    if (!observeActive) {
      setActiveId(null);
      return undefined;
    }

    return observeActiveHeading(navigation.flatItems, setActiveId, {
      root,
      offsetTop,
      rootMargin,
      threshold,
    });
  }, [navigation, observeActive, offsetTop, root, rootMargin, threshold]);

  return {
    ...navigation,
    activeId,
    navigate(target, overrides = {}) {
      return navigateToContentHeading(target, {
        root: overrides.root ?? root ?? undefined,
        offsetTop: overrides.offsetTop ?? offsetTop,
        ...navigateOptions,
        ...overrides,
      });
    },
  };
}
