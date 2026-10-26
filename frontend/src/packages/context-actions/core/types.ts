import type { ReactNode } from "react";

export type ContextActionItem = {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  danger?: boolean;
  hidden?: boolean;
};

export type ContextActionGroup = {
  group: number;
  children: ContextActionItem[];
};

export type NormalizedContextActionGroup = {
  group: number;
  children: ContextActionItem[];
};

export type ContextActionPoint = {
  x: number;
  y: number;
};
