import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import {
  CommandTemplatePicker,
  renderCommandTemplatePicker
} from '../../src/components/CommandTemplatePicker.js';
import {
  MobileShortcutBar,
  renderMobileShortcutBar
} from '../../src/components/MobileShortcutBar.js';
import { PasteConfirm, renderPasteConfirm } from '../../src/components/PasteConfirm.js';
import { createSpeechInputAdapter } from '../../src/services/speechInput.js';

describe('mobile input helpers', () => {
  it('renders common mobile command shortcuts', () => {
    const summary = renderMobileShortcutBar([
      { label: '测试', input: 'npm test\n' },
      { label: '状态', input: 'git status\n' }
    ]);

    expect(summary).toContain('2 个移动快捷命令');
    expect(summary).toContain('测试：npm test');
    expect(summary).toContain('状态：git status');
  });

  it('renders command templates with placeholders', () => {
    const summary = renderCommandTemplatePicker([
      { id: 'commit', label: '提交', template: 'git commit -m "{{message}}"' }
    ]);

    expect(summary).toContain('提交');
    expect(summary).toContain('{{message}}');
  });

  it('requires confirmation before sending pasted multi-line input', () => {
    expect(renderPasteConfirm('npm test\n git status\n')).toContain('2 行粘贴内容等待确认');
    expect(renderPasteConfirm('')).toBe('没有待确认的粘贴内容。');
  });

  it('keeps speech input behind an optional adapter boundary', async () => {
    const adapter = createSpeechInputAdapter({ available: false });

    expect(adapter.available).toBe(false);
    await expect(adapter.start()).rejects.toThrow('Speech input is unavailable');
  });

  it('sends a shortcut only after its button is clicked', async () => {
    const sentInputs: string[] = [];
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MobileShortcutBar
          shortcuts={[{ label: '测试', input: 'npm test\n' }]}
          onSend={(input) => sentInputs.push(input)}
        />
      );
    });

    expect(sentInputs).toEqual([]);
    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(sentInputs).toEqual(['npm test\n']);

    await act(async () => {
      root.unmount();
    });
  });

  it('selects a command template only after its button is clicked', async () => {
    const selectedTemplates: string[] = [];
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CommandTemplatePicker
          templates={[{ id: 'commit', label: '提交', template: 'git commit -m "{{message}}"' }]}
          onSelect={(template) => selectedTemplates.push(template.id)}
        />
      );
    });

    expect(selectedTemplates).toEqual([]);
    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(selectedTemplates).toEqual(['commit']);

    await act(async () => {
      root.unmount();
    });
  });

  it('requires an explicit paste confirmation before sending payload', async () => {
    const confirmedPayloads: string[] = [];
    let cancelled = false;
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PasteConfirm
          payload={'npm test\ngit status\n'}
          onConfirm={(payload) => confirmedPayloads.push(payload)}
          onCancel={() => {
            cancelled = true;
          }}
        />
      );
    });

    expect(confirmedPayloads).toEqual([]);
    expect(cancelled).toBe(false);

    const buttons = container.querySelectorAll('button');
    await act(async () => {
      buttons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(confirmedPayloads).toEqual(['npm test\ngit status\n']);

    await act(async () => {
      buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(cancelled).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });
});
