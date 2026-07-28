import * as React from "react";

/**
 * `useLayoutEffect` where there is a layout, `useEffect` where there is not:
 * the server has no DOM to measure, and React warns about the former there.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export { useIsomorphicLayoutEffect };
