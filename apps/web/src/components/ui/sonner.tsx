"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useThemePreference } from "~/components/theme/theme-provider";

const Toaster = ({ ...props }: ToasterProps) => {
  const { preference } = useThemePreference();

  return (
    <Sonner
      theme={preference}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--infokit-surface)",
          "--normal-text": "var(--infokit-ink)",
          "--normal-border": "var(--infokit-border)",
          "--border-radius": "var(--infokit-radius-control)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "border-line bg-surface text-ink shadow-lg",
          success: "border-ok/40 bg-ok-soft",
          error: "border-danger/40 bg-danger-soft",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
