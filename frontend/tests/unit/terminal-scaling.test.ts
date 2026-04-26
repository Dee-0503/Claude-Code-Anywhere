import { describe, expect, it } from 'vitest';

import {
  calculateTerminalScale,
  createTerminalScaleObserver,
  measureTerminalCharacterWidth
} from '../../src/terminal/scaling.js';

describe('terminal scaling', () => {
  it('keeps a 120-column terminal at full scale when the container fits', () => {
    expect(calculateTerminalScale({ containerWidth: 960, characterWidth: 8 })).toEqual({
      columns: 120,
      scale: 1,
      contentWidth: 960
    });
  });

  it('scales a fixed 120-column terminal down for narrow containers', () => {
    expect(calculateTerminalScale({ containerWidth: 480, characterWidth: 8 })).toEqual({
      columns: 120,
      scale: 0.5,
      contentWidth: 960
    });
  });

  it('uses the minimum scale when the measured width is unusable', () => {
    expect(calculateTerminalScale({ containerWidth: 0, characterWidth: 8 })).toEqual({
      columns: 120,
      scale: 0.5,
      contentWidth: 960
    });
  });

  it('updates scaling when the terminal container is resized', () => {
    const observedScales: number[] = [];
    const element = document.createElement('div');
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 480 });

    const observer = createTerminalScaleObserver({
      element,
      getCharacterWidth: () => 8,
      onScaleChange: (scale) => observedScales.push(scale.scale)
    });

    observer.recalculate();
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 960 });
    observer.recalculate();
    observer.disconnect();

    expect(observedScales).toEqual([0.5, 1]);
  });

  it('uses measured terminal character width when observing scale changes', () => {
    const observedContentWidths: number[] = [];
    const element = document.createElement('div');
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 960 });
    let characterWidth = 10;

    const observer = createTerminalScaleObserver({
      element,
      getCharacterWidth: () => characterWidth,
      onScaleChange: (scale) => observedContentWidths.push(scale.contentWidth)
    });

    observer.recalculate();
    characterWidth = 6;
    observer.recalculate();
    observer.disconnect();

    expect(observedContentWidths).toEqual([1200, 720]);
  });

  it('measures terminal character width from rendered cell metrics', () => {
    const terminalElement = document.createElement('div');
    const charElement = document.createElement('span');
    charElement.className = 'xterm-char-measure-element';
    Object.defineProperty(charElement, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 9.5 })
    });
    terminalElement.append(charElement);

    expect(measureTerminalCharacterWidth(terminalElement)).toBe(9.5);
  });

  it('falls back when terminal character width cannot be measured', () => {
    expect(measureTerminalCharacterWidth(document.createElement('div'))).toBe(8);
  });
});
