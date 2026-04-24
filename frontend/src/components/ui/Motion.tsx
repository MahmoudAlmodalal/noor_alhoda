"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { Children, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

type MotionProps = HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section" | "article";
  delayMs?: number;
  children: ReactNode;
};

function withDelay(delayMs?: number): React.CSSProperties | undefined {
  if (!delayMs) return undefined;
  return { animationDelay: `${delayMs}ms` };
}

export function FadeIn({
  className,
  style,
  delayMs,
  children,
  as = "div",
  ...rest
}: MotionProps) {
  const Tag = as;
  return (
    <Tag
      className={cn("motion-fade-up", className)}
      style={{ ...withDelay(delayMs), ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Pop({
  className,
  style,
  delayMs,
  children,
  as = "div",
  ...rest
}: MotionProps) {
  const Tag = as;
  return (
    <Tag
      className={cn("motion-pop", className)}
      style={{ ...withDelay(delayMs), ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

type StaggerProps = HTMLAttributes<HTMLDivElement> & {
  stepMs?: number;
  startMs?: number;
  children: ReactNode;
};

export function Stagger({
  stepMs = 60,
  startMs = 0,
  className,
  children,
  ...rest
}: StaggerProps) {
  const items = Children.toArray(children);
  return (
    <div className={className} {...rest}>
      {items.map((child, i) => {
        if (!isValidElement(child)) return child;
        const existing = (child.props as { style?: React.CSSProperties }).style;
        const existingClass =
          (child.props as { className?: string }).className ?? "";
        return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
          key: child.key ?? i,
          className: cn("motion-fade-up", existingClass),
          style: {
            animationDelay: `${startMs + i * stepMs}ms`,
            ...(existing ?? {}),
          },
        } as Record<string, unknown>);
      })}
    </div>
  );
}
