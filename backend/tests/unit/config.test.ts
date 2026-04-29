import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config.js';

describe('loadConfig TLS production guidance', () => {
  it('rejects direct TLS certificate configuration because the server only supports reverse proxy TLS termination', () => {
    expect(() =>
      loadConfig({
        CCA_TLS_MODE: 'provided',
        CCA_TLS_CERT_PATH: '/tmp/server.crt',
        CCA_TLS_KEY_PATH: '/tmp/server.key'
      })
    ).toThrow('CCA_TLS_MODE=provided is not supported; terminate TLS at a trusted reverse proxy');

    expect(() =>
      loadConfig({
        CCA_TLS_MODE: 'self-signed'
      })
    ).toThrow(
      'CCA_TLS_MODE=self-signed is not supported; terminate TLS at a trusted reverse proxy'
    );
  });

  it('rejects plaintext TLS mode in production unless a trusted reverse proxy terminates TLS', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        CCA_TLS_MODE: 'off'
      })
    ).toThrow('CCA_TLS_MODE=off is only allowed in production when CCA_TRUST_REVERSE_PROXY=true');

    expect(
      loadConfig({
        NODE_ENV: 'production',
        CCA_TLS_MODE: 'off',
        CCA_TRUST_REVERSE_PROXY: 'true'
      }).trustReverseProxy
    ).toBe(true);
  });

  it('rejects certificate paths when direct TLS is disabled', () => {
    expect(() =>
      loadConfig({
        CCA_TLS_CERT_PATH: 'certs/local.crt'
      })
    ).toThrow('CCA_TLS_CERT_PATH is not supported; terminate TLS at a trusted reverse proxy');
  });
});

describe('loadConfig instance hardening', () => {
  it('loads configured workspace roots and active instance limits', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'cca-config-'));
    const workspaceA = join(tempDir, 'workspace-a');
    const workspaceB = join(tempDir, 'workspace-b');
    mkdirSync(workspaceA);
    mkdirSync(workspaceB);

    try {
      const config = loadConfig({
        CCA_INSTANCE_ALLOWED_WORKSPACE_ROOTS: `${workspaceA}, ${workspaceB}`,
        CCA_INSTANCE_MAX_ACTIVE_PER_DEVICE: '3',
        CCA_INSTANCE_MAX_ACTIVE_GLOBAL: '9'
      });

      expect(config.instanceAllowedWorkspaceRoots).toEqual([workspaceA, workspaceB]);
      expect(config.instanceMaxActivePerDevice).toBe(3);
      expect(config.instanceMaxActiveGlobal).toBe(9);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects invalid instance hardening configuration', () => {
    expect(() =>
      loadConfig({
        CCA_INSTANCE_ALLOWED_WORKSPACE_ROOTS: '/path/that/does/not/exist'
      })
    ).toThrow('CCA_INSTANCE_ALLOWED_WORKSPACE_ROOTS entries must be existing directories');

    expect(() =>
      loadConfig({
        CCA_INSTANCE_MAX_ACTIVE_PER_DEVICE: '0'
      })
    ).toThrow('CCA_INSTANCE_MAX_ACTIVE_PER_DEVICE must be >= 1');

    expect(() =>
      loadConfig({
        CCA_INSTANCE_MAX_ACTIVE_GLOBAL: '0'
      })
    ).toThrow('CCA_INSTANCE_MAX_ACTIVE_GLOBAL must be >= 1');
  });
});
