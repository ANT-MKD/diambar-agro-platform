import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// @testing-library/react's renderHook triggers a null hook-dispatcher crash in this
// project's Vitest setup (a dual React-module-instance issue specific to its CJS
// act-compat/test-utils requires -- confirmed unrelated to happy-dom vs jsdom, and
// unrelated to store.ts itself: a bare `renderHook(() => useState(0))` reproduces it).
// A plain `react-dom/client` + `act` render, with no testing-library involved, does not
// hit the bug, so this is a minimal stand-in with the same `{ result: { current } }` shape.

const mountedRoots = new Set<Root>();

export function renderHook<T>(callback: () => T) {
  let value: T;
  function TestComponent() {
    value = callback();
    return null;
  }

  const container = document.createElement("div");
  const root = createRoot(container);
  mountedRoots.add(root);

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    result: {
      get current() {
        return value;
      },
    },
    rerender() {
      act(() => {
        root.render(<TestComponent />);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      mountedRoots.delete(root);
    },
  };
}

export function cleanupRenderedHooks() {
  for (const root of mountedRoots) {
    act(() => {
      root.unmount();
    });
  }
  mountedRoots.clear();
}

export { act };
