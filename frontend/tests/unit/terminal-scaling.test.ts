import { describe, expect, it } from "vitest";

import { calculateTerminalScale, createTerminalScaleObserver } from "../../src/terminal/scaling.js";

describe("terminal scaling", () => {
  it("keeps a 120-column terminal at full scale when the container fits", () => {
    expect(calculateTerminalScale({ containerWidth: 960, characterWidth: 8 })).toEqual({
      columns: 120,
      scale: 1,
      contentWidth: 960,
    });
  });

  it("scales a fixed 120-column terminal down for narrow containers", () => {
    expect(calculateTerminalScale({ containerWidth: 480, characterWidth: 8 })).toEqual({
      columns: 120,
      scale: 0.5,
      contentWidth: 960,
    });
  });

  it("uses the minimum scale when the measured width is unusable", () => {
    expect(calculateTerminalScale({ containerWidth: 0, characterWidth: 8 })).toEqual({
      columns: 120,
      scale: 0.5,
      contentWidth: 960,
    });
  });

  it("updates scaling when the terminal container is resized", () => {
    const observedScales: number[] = [];
    const element = document.createElement("div");
    Object.defineProperty(element, "clientWidth", { configurable: true, value: 480 });

    const observer = createTerminalScaleObserver({
      element,
      characterWidth: 8,
      onScaleChange: (scale) => observedScales.push(scale.scale),
    });

    observer.recalculate();
    Object.defineProperty(element, "clientWidth", { configurable: true, value: 960 });
    observer.recalculate();
    observer.disconnect();

    expect(observedScales).toEqual([0.5, 1]);
  });
});
