import * as React from "react";

import { useIsomorphicLayoutEffect } from "~/hooks/use-isomorphic-layout-effect";

/**
 * The latest props in a ref, so a callback can read them without listing them
 * as dependencies — the callback then keeps its identity across renders.
 */
function useAsRef<T>(props: T) {
  const ref = React.useRef<T>(props);

  useIsomorphicLayoutEffect(() => {
    ref.current = props;
  });

  return ref;
}

export { useAsRef };
