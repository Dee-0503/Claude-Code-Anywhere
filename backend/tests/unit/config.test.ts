import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config.js";

describe("loadConfig TLS production guidance", () => {
  it("rejects direct TLS certificate configuration because the server only supports reverse proxy TLS termination", () => {
    expect(() => loadConfig({
      CCA_TLS_MODE: "provided",
      CCA_TLS_CERT_PATH: "/tmp/server.crt",
      CCA_TLS_KEY_PATH: "/tmp/server.key",
    })).toThrow("CCA_TLS_MODE=provided is not supported; terminate TLS at a trusted reverse proxy");

    expect(() => loadConfig({
      CCA_TLS_MODE: "self-signed",
    })).toThrow("CCA_TLS_MODE=self-signed is not supported; terminate TLS at a trusted reverse proxy");
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

  it("rejects certificate paths when direct TLS is disabled", () => {
    expect(() => loadConfig({
      CCA_TLS_CERT_PATH: "certs/local.crt",
    })).toThrow("CCA_TLS_CERT_PATH is not supported; terminate TLS at a trusted reverse proxy");
  });
});
