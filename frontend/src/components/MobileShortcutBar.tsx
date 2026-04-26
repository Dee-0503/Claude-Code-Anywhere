import type { ReactElement } from "react";

export interface MobileShortcut {
  readonly label: string;
  readonly input: string;
}

export function renderMobileShortcutBar(shortcuts: readonly MobileShortcut[]): string {
  if (shortcuts.length === 0) {
    return "没有移动快捷命令。";
  }

  return `${shortcuts.length} 个移动快捷命令：${shortcuts.map((shortcut) => `${shortcut.label}：${shortcut.input.trim()}`).join("；")}`;
}

export interface MobileShortcutBarProps {
  readonly shortcuts: readonly MobileShortcut[];
  readonly onSend?: (input: string) => void;
}

export function MobileShortcutBar({ shortcuts, onSend }: MobileShortcutBarProps): ReactElement {
  return (
    <section aria-label="移动快捷命令">
      <p>{renderMobileShortcutBar(shortcuts)}</p>
      {shortcuts.map((shortcut) => (
        <button key={shortcut.label} type="button" onClick={() => onSend?.(shortcut.input)}>
          {shortcut.label}
        </button>
      ))}
    </section>
  );
}
