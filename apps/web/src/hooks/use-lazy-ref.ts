import * as React from "react";

/** A ref whose initial value is built once, on the first render that needs it. */
function useLazyRef<T>(fn: () => T) {
  const ref = React.useRef<T | null>(null);

  ref.current ??= fn();

  return ref as React.RefObject<T>;
}

export { useLazyRef };
