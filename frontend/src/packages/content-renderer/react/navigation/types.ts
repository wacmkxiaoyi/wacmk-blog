export type NavigateToContentHeadingOptions = {
  root?: Document | HTMLElement;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
  offsetTop?: number;
  updateHash?: boolean;
  focus?: boolean;
  instanceId?: string;
};

export type ObserveActiveHeadingOptions = {
  root?: HTMLElement | null;
  offsetTop?: number;
  rootMargin?: string;
  threshold?: number | number[];
  instanceId?: string;
};
