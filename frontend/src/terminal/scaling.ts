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
  readonly characterWidth: number;
  readonly onScaleChange: (scale: TerminalScale) => void;
}

export interface TerminalScaleObserver {
  recalculate(): void;
  disconnect(): void;
}

const TERMINAL_COLUMNS = 120;
const MINIMUM_SCALE = 0.5;

export function calculateTerminalScale(input: TerminalScaleInput): TerminalScale {
  const contentWidth = TERMINAL_COLUMNS * input.characterWidth;
  const rawScale = input.containerWidth > 0 ? input.containerWidth / contentWidth : MINIMUM_SCALE;
  const scale = Math.min(1, Math.max(MINIMUM_SCALE, rawScale));

  return {
    columns: TERMINAL_COLUMNS,
    scale,
    contentWidth,
  };
}

export function createTerminalScaleObserver(options: TerminalScaleObserverOptions): TerminalScaleObserver {
  const resizeObserver = typeof ResizeObserver === "undefined"
    ? null
    : new ResizeObserver(() => recalculate());

  function recalculate(): void {
    options.onScaleChange(calculateTerminalScale({
      containerWidth: options.element.clientWidth,
      characterWidth: options.characterWidth,
    }));
  }

  resizeObserver?.observe(options.element);
  window.addEventListener("resize", recalculate);
  window.addEventListener("orientationchange", recalculate);

  return {
    recalculate,
    disconnect() {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", recalculate);
      window.removeEventListener("orientationchange", recalculate);
    },
  };
}
