import type { PtyAdapter, PtyProcess, PtySpawnOptions } from "./pty-adapter.js";
import { validatePtySize } from "./pty-adapter.js";

export class NodePtyAdapter implements PtyAdapter {
  spawn(options: PtySpawnOptions): PtyProcess {
    const size = options.size ?? { cols: 120, rows: 30 };
    validatePtySize(size);

    throw new Error(
      "NodePtyAdapter requires node-pty runtime wiring; use a test adapter or install runtime integration before production use",
    );
  }
}

export function createNodePtyAdapter(): PtyAdapter {
  return new NodePtyAdapter();
}
