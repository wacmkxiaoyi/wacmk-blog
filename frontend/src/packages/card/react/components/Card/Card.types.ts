import type React from "react";

type CardDimension = number | string;

export type CardBaseProps = {
  content: React.ReactNode;
  bottomContent?: React.ReactNode | null;
  sideContent?: React.ReactNode | null;
  sidePosition?: "left" | "right";
  className?: string;
  contentClassName?: string;
  bottomClassName?: string;
  sideClassName?: string;
  interactive?: boolean;
  tone?: "default" | "soft" | "cover";
  gap?: CardDimension;
  contentWidth?: CardDimension;
  contentHeight?: CardDimension;
  sideWidth?: CardDimension;
  sideHeight?: CardDimension;
  bottomWidth?: CardDimension;
  bottomHeight?: CardDimension;
  style?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  bottomStyle?: React.CSSProperties;
  sideStyle?: React.CSSProperties;
};

export type CardProps = CardBaseProps;
