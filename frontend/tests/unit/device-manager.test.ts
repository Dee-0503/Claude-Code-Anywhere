import { describe, expect, it } from "vitest";

import { renderDeviceManager } from "../../src/components/DeviceManager.js";

describe("device manager UI helper", () => {
  it("summarizes active devices and available admin actions", () => {
    const summary = renderDeviceManager([
      { id: "admin-device", name: "Cee MacBook", role: "admin", revokedAt: null },
      { id: "member-device", name: "Cee iPhone", role: "member", revokedAt: null },
    ]);

    expect(summary).toContain("2 台已配对设备");
    expect(summary).toContain("管理员：Cee MacBook");
    expect(summary).toContain("可撤销：Cee iPhone");
  });

  it("marks revoked devices as inaccessible", () => {
    expect(renderDeviceManager([
      { id: "member-device", name: "旧 iPad", role: "member", revokedAt: "2026-04-25T12:00:00.000Z" },
    ])).toContain("旧 iPad 已撤销访问");
  });
});
