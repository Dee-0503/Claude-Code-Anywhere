import { describe, expect, it } from "vitest";

import { renderCommandTemplatePicker } from "../../src/components/CommandTemplatePicker.js";
import { renderMobileShortcutBar } from "../../src/components/MobileShortcutBar.js";
import { renderPasteConfirm } from "../../src/components/PasteConfirm.js";
import { createSpeechInputAdapter } from "../../src/services/speechInput.js";

describe("mobile input helpers", () => {
  it("renders common mobile command shortcuts", () => {
    const summary = renderMobileShortcutBar([
      { label: "测试", input: "npm test\n" },
      { label: "状态", input: "git status\n" },
    ]);

    expect(summary).toContain("2 个移动快捷命令");
    expect(summary).toContain("测试：npm test");
    expect(summary).toContain("状态：git status");
  });

  it("renders command templates with placeholders", () => {
    const summary = renderCommandTemplatePicker([
      { id: "commit", label: "提交", template: "git commit -m \"{{message}}\"" },
    ]);

    expect(summary).toContain("提交");
    expect(summary).toContain("{{message}}");
  });

  it("requires confirmation before sending pasted multi-line input", () => {
    expect(renderPasteConfirm("npm test\n git status\n")).toContain("2 行粘贴内容等待确认");
    expect(renderPasteConfirm("")).toBe("没有待确认的粘贴内容。");
  });

  it("keeps speech input behind an optional adapter boundary", async () => {
    const adapter = createSpeechInputAdapter({ available: false });

    expect(adapter.available).toBe(false);
    await expect(adapter.start()).rejects.toThrow("Speech input is unavailable");
  });
});
