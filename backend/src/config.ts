import { resolve } from "node:path";

export type TlsMode = "off" | "self-signed" | "provided";

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
  readonly tlsMode: TlsMode;
  readonly outputBufferBytes: number;
  readonly heartbeatIntervalMs: number;
  readonly heartbeatTimeoutMs: number;
}

export interface ConfigEnvironment {
  readonly [key: string]: string | undefined;
}

const DEFAULT_CONFIG: AppConfig = {
  host: "127.0.0.1",
  port: 5178,
  databasePath: resolve(process.cwd(), "data", "claude-code-anywhere.sqlite"),
  tlsMode: "off",
  outputBufferBytes: 1024 * 1024,
  heartbeatIntervalMs: 15_000,
  heartbeatTimeoutMs: 45_000,
};

function readInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  options: { min?: number; max?: number } = {},
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`${name} must be >= ${options.min}`);
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new Error(`${name} must be <= ${options.max}`);
  }

  return parsed;
}

function readTlsMode(value: string | undefined): TlsMode {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_CONFIG.tlsMode;
  }

  if (value === "off" || value === "self-signed" || value === "provided") {
    return value;
  }

  throw new Error("CCA_TLS_MODE must be one of: off, self-signed, provided");
}

export function loadConfig(env: ConfigEnvironment = process.env): AppConfig {
  const host = env.CCA_HOST?.trim() || DEFAULT_CONFIG.host;
  const port = readInteger(env.CCA_PORT, DEFAULT_CONFIG.port, "CCA_PORT", {
    min: 1,
    max: 65_535,
  });
  const databasePath = resolve(
    env.CCA_DATABASE_PATH?.trim() || DEFAULT_CONFIG.databasePath,
  );
  const tlsMode = readTlsMode(env.CCA_TLS_MODE);
  const outputBufferBytes = readInteger(
    env.CCA_OUTPUT_BUFFER_BYTES,
    DEFAULT_CONFIG.outputBufferBytes,
    "CCA_OUTPUT_BUFFER_BYTES",
    { min: 1 },
  );
  const heartbeatIntervalMs = readInteger(
    env.CCA_HEARTBEAT_INTERVAL_MS,
    DEFAULT_CONFIG.heartbeatIntervalMs,
    "CCA_HEARTBEAT_INTERVAL_MS",
    { min: 1 },
  );
  const heartbeatTimeoutMs = readInteger(
    env.CCA_HEARTBEAT_TIMEOUT_MS,
    DEFAULT_CONFIG.heartbeatTimeoutMs,
    "CCA_HEARTBEAT_TIMEOUT_MS",
    { min: heartbeatIntervalMs },
  );

  return {
    host,
    port,
    databasePath,
    tlsMode,
    outputBufferBytes,
    heartbeatIntervalMs,
    heartbeatTimeoutMs,
  };
}

export const config = loadConfig();
