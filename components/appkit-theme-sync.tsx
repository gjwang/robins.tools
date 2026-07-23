"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAppKitTheme } from "@reown/appkit/react";

/**
 * Keeps the Reown AppKit modal's theme in lockstep with the theme resolved by
 * next-themes. Renders nothing.
 */
export function AppKitThemeSync() {
  const { resolvedTheme } = useTheme();
  const { setThemeMode } = useAppKitTheme();

  useEffect(() => {
    if (resolvedTheme === "dark" || resolvedTheme === "light") {
      setThemeMode(resolvedTheme);
    }
  }, [resolvedTheme, setThemeMode]);

  return null;
}
