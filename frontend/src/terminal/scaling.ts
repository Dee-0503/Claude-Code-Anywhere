export interface TerminalScaleInput {
  readonly containerWidth: number;
  readonly characterWidth: number;
}

export interface TerminalScale {
  readonly columns: 120;
  readonly scale: number;
  readonly contentWidth: number;
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
