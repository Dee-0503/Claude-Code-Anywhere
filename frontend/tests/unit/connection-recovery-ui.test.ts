import { describe, expect, it } from "vitest";

import { renderConnectionStatus } from "../../src/components/ConnectionStatus.js";
import { renderOfflineInputConfirm } from "../../src/components/OfflineInputConfirm.js";

describe("connection recovery UI helpers", () => {
  it("renders degraded, disconnected, and reconnecting states", () => {
    expect(renderConnectionStatus("degraded")).toContain("网络较弱");
    expect(renderConnectionStatus("disconnected")).toContain("连接已断开");
    expect(renderConnectionStatus("reconnecting")).toContain("正在重连");
  });

  it("describes pending offline input before replay", () => {
    expect(renderOfflineInputConfirm([
      { inputId: "input-1", payload: "npm test\n" },
      { inputId: "input-2", payload: "git status\n" },
    ])).toContain("2 条离线输入等待确认");
  });
});
