import type { ClaudeInstanceId } from "../../../shared/protocol/domain.js";

const OFFSET_KEY_PREFIX = "cca.lastOutputOffset";

export interface ReconnectOffsets {
  readonly [instanceId: string]: number;
}

function offsetKey(instanceId: ClaudeInstanceId): string {
  return `${OFFSET_KEY_PREFIX}.${instanceId}`;
}

export function saveLastOutputOffset(
  instanceId: ClaudeInstanceId,
  offset: number,
  storage: Storage = window.localStorage,
): void {
  if (!Number.isInteger(offset) || offset < 0) {
    return;
  }

  storage.setItem(offsetKey(instanceId), String(offset));
}

export function loadLastOutputOffset(
  instanceId: ClaudeInstanceId,
  storage: Storage = window.localStorage,
): number {
  const raw = storage.getItem(offsetKey(instanceId));
  const parsed = raw === null ? 0 : Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function forgetLastOutputOffset(instanceId: ClaudeInstanceId, storage: Storage = window.localStorage): void {
  storage.removeItem(offsetKey(instanceId));
}

export function loadReconnectOffsets(
  instanceIds: readonly ClaudeInstanceId[],
  storage: Storage = window.localStorage,
): ReconnectOffsets {
  return Object.fromEntries(
    instanceIds.map((instanceId) => [instanceId, loadLastOutputOffset(instanceId, storage)]),
  );
}
