import { vi } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
vi.stubGlobal("MutationObserver", ResizeObserverMock);

Object.defineProperties(HTMLElement.prototype, {
  clientWidth: { configurable: true, get: () => 1200 },
  clientHeight: { configurable: true, get: () => 800 },
  getBoundingClientRect: {
    configurable: true,
    value() {
      return {
        x: 0,
        y: 0,
        top: 0,
        right: 1200,
        bottom: 800,
        left: 0,
        width: 1200,
        height: 800,
        toJSON: () => ({}),
      };
    },
  },
});
