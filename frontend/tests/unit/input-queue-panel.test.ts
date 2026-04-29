import { describe, expect, it } from 'vitest';

import { renderInputQueuePanel } from '../../src/components/InputQueuePanel.js';

describe('input queue panel UI helper', () => {
  it('shows queued input count and cancelable payloads', () => {
    const summary = renderInputQueuePanel([
      { inputId: 'input-1', deviceId: 'mac', payload: 'npm test\n' },
      { inputId: 'input-2', deviceId: 'phone', payload: 'git status\n' }
    ]);

    expect(summary).toContain('2 条输入等待发送');
    expect(summary).toContain('mac：npm test');
    expect(summary).toContain('phone：git status');
  });

  it('shows an empty state when no queued input exists', () => {
    expect(renderInputQueuePanel([])).toBe('没有等待发送的输入。');
  });
});
