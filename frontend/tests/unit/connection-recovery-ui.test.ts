import { describe, expect, it } from "vitest";

import { renderConnectionStatus } from "../../src/components/ConnectionStatus.js";
import { renderNotificationCenter } from "../../src/components/NotificationCenter.js";
import { renderOfflineInputConfirm } from "../../src/components/OfflineInputConfirm.js";
import { renderAuthorizationPrompt } from "../../src/components/AuthorizationPrompt.js";

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

  it("summarizes unread routed notifications", () => {
    expect(renderNotificationCenter([
      { id: "notice-1", title: "需要授权", priority: "urgent", status: "delivered" },
      { id: "notice-2", title: "任务完成", priority: "normal", status: "read" },
    ])).toContain("1 条未读通知");
  });

  it("describes authorization prompts as terminal-native decisions", () => {
    expect(renderAuthorizationPrompt({
      title: "允许命令？",
      body: "Claude Code 请求运行 npm test",
      status: "waiting",
    })).toContain("请在终端原生审批提示中操作");
  });
});
