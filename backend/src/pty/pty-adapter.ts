export interface PtySize {
  readonly cols: number;
  readonly rows: number;
}

export interface PtySpawnOptions {
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly size?: PtySize;
}

export interface PtyProcess {
  readonly pid: number;
  write(data: string): void;
  resize(size: PtySize): void;
  kill(signal?: NodeJS.Signals): void;
  onData(listener: (data: string) => void): void;
  onExit(listener: (exit: PtyExit) => void): void;
}

export interface PtyExit {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
}

export interface PtyAdapter {
  spawn(options: PtySpawnOptions): PtyProcess;
}

export function validatePtySize(size: PtySize): void {
  if (!Number.isInteger(size.cols) || size.cols < 1) {
    throw new Error("PTY cols must be a positive integer");
  }

  if (!Number.isInteger(size.rows) || size.rows < 1) {
    throw new Error("PTY rows must be a positive integer");
  }
}
