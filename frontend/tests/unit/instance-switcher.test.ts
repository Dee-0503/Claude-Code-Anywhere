import { describe, expect, it } from 'vitest';

import { renderInstanceSwitcher } from '../../src/components/InstanceSwitcher.js';

describe('instance switcher UI helper', () => {
  it('shows the current instance and available switch targets', () => {
    const summary = renderInstanceSwitcher({
      currentInstanceId: 'instance-1',
      instances: [
        { id: 'instance-1', name: 'main', status: 'running' },
        { id: 'instance-2', name: 'review', status: 'exited' }
      ]
    });

    expect(summary).toContain('当前实例：main');
    expect(summary).toContain('可切换实例：review（exited）');
  });

  it('shows an empty state when no instances exist', () => {
    expect(renderInstanceSwitcher({ currentInstanceId: null, instances: [] })).toBe(
      '暂无 Claude Code 实例。'
    );
  });
});
