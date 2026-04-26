import { describe, expect, it } from 'vitest';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe('browser entrypoint', () => {
  it('mounts the app into the browser root element', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await import('../../src/main.js');
    await nextFrame();

    expect(document.body.textContent).toContain('随行终端');
  });
});
