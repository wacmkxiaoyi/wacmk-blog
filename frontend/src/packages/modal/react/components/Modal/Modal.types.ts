import type { ReactNode } from "react";

export type ModalTone = "normal" | "info" | "success" | "warning" | "error";

export type ModalSize = "sm" | "md" | "wide" | "table" | "attachmentBrowser";

export type ModalActionVariant = "primary" | "secondary" | "danger" | "ghost";

export type ModalApi = {
  close: () => void;
};

export type ModalAction = {
  key: string;
  label: ReactNode;
  loadingLabel?: ReactNode;
  variant?: ModalActionVariant;
  visible?: boolean;
  disabled?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  keepOpen?: boolean;
  onClick?: (api: ModalApi) => void | Promise<void>;
};

export type ModalLabels = {
  close?: string;
  cancel?: string;
  confirm?: string;
  loading?: string;
};

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  kicker?: ReactNode;
  tone?: ModalTone;
  size?: ModalSize;
  children?: ReactNode;
  actions?: ModalAction[];
  closeOnEsc?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  className?: string;
  labels?: ModalLabels;
};
