import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config.js";

describe("loadConfig TLS production guidance", () => {
  it("requires certificate and key paths when provided TLS mode is selected", () => {
    expect(() => loadConfig({
      CCA_TLS_MODE: "provided",
      CCA_TLS_CERT_PATH: "/tmp/server.crt",
    })).toThrow("CCA_TLS_KEY_PATH is required when CCA_TLS_MODE=provided");
  });

  it("rejects plaintext TLS mode in production unless a trusted reverse proxy terminates TLS", () => {
    expect(() => loadConfig({
      NODE_ENV: "production",
      CCA_TLS_MODE: "off",
    })).toThrow("CCA_TLS_MODE=off is only allowed in production when CCA_TRUST_REVERSE_PROXY=true");

    expect(loadConfig({
      NODE_ENV: "production",
      CCA_TLS_MODE: "off",
      CCA_TRUST_REVERSE_PROXY: "true",
    }).trustReverseProxy).toBe(true);
  });

  it("normalizes provided TLS certificate paths", () => {
    const config = loadConfig({
      CCA_TLS_MODE: "provided",
      CCA_TLS_CERT_PATH: "certs/local.crt",
      CCA_TLS_KEY_PATH: "certs/local.key",
    });

    expect(config.tlsCertPath).toContain("certs/local.crt");
    expect(config.tlsKeyPath).toContain("certs/local.key");
    expect(config.trustReverseProxy).toBe(false);
  });
});
