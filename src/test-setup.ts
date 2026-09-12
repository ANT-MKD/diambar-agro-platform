import { afterEach } from "vitest";
import { cleanupRenderedHooks } from "./test-utils/render-hook";

// Silences React's "not configured to support act(...)" warning for the
// custom render-hook harness (see test-utils/render-hook.tsx for why it
// exists instead of @testing-library/react).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanupRenderedHooks();
});
