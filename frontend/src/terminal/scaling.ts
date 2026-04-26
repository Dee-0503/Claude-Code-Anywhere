export interface TerminalScaleInput {
  readonly containerWidth: number;
  readonly characterWidth: number;
}

export interface TerminalScale {
  readonly columns: 120;
  readonly scale: number;
  readonly contentWidth: number;
}

export interface TerminalScaleObserverOptions {
  readonly element: HTMLElement;
  readonly getCharacterWidth: () => number;
  readonly onScaleChange: (scale: TerminalScale) => void;
}

export interface TerminalScaleObserver {
  recalculate(): void;
  disconnect(): void;
}

const TERMINAL_COLUMNS = 120;
const MINIMUM_SCALE = 0.5;
const DEFAULT_CHARACTER_WIDTH = 8;

export function measureTerminalCharacterWidth(
  element: HTMLElement,
  fallback = DEFAULT_CHARACTER_WIDTH
): number {
  const measuredElement = element.querySelector('.xterm-char-measure-element');
  if (!(measuredElement instanceof HTMLElement)) {
    return fallback;
  }

  const width = measuredElement.getBoundingClientRect().width;
  return width > 0 ? width : fallback;
}

export function calculateTerminalScale(input: TerminalScaleInput): TerminalScale {
  const contentWidth = TERMINAL_COLUMNS * input.characterWidth;
  const rawScale = input.containerWidth > 0 ? input.containerWidth / contentWidth : MINIMUM_SCALE;
  const scale = Math.min(1, Math.max(MINIMUM_SCALE, rawScale));

  return {
    columns: TERMINAL_COLUMNS,
    scale,
    contentWidth
  };
}

export function createTerminalScaleObserver(
  options: TerminalScaleObserverOptions
): TerminalScaleObserver {
  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => recalculate());

  function recalculate(): void {
    options.onScaleChange(
      calculateTerminalScale({
        containerWidth: options.element.clientWidth,
        characterWidth: options.getCharacterWidth()
      })
    );
  }

  resizeObserver?.observe(options.element);
  window.addEventListener('resize', recalculate);
  window.addEventListener('orientationchange', recalculate);

  return {
    recalculate,
    disconnect() {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', recalculate);
      window.removeEventListener('orientationchange', recalculate);
    }
  };
}
