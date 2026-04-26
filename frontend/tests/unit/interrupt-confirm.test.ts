import { describe, expect, it } from 'vitest';

import { renderInterruptConfirm } from '../../src/components/InterruptConfirm.js';

describe('interrupt confirmation UI helper', () => {
  it('describes Ctrl+C as an explicit confirmation', () => {
    expect(
      renderInterruptConfirm({
        inputId: 'interrupt-1',
        deviceId: 'phone',
        pending: true
      })
    ).toContain('phone 请求发送 Ctrl+C，中断当前 Claude Code 会话前需要确认');
  });

  it('hides when no interrupt is pending', () => {
    expect(renderInterruptConfirm({ inputId: null, deviceId: null, pending: false })).toBe(
      '没有待确认的中断请求。'
    );
  });
});
