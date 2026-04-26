import { resolve } from "node:path";

export type TlsMode = "off";
export type RepositoryMode = "sqlite" | "memory";

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
  readonly repositoryMode: RepositoryMode;
  readonly tlsMode: TlsMode;
  readonly trustReverseProxy: boolean;
  readonly outputBufferBytes: number;
  readonly heartbeatIntervalMs: number;
  readonly heartbeatTimeoutMs: number;
  readonly websocketPath: string;
  readonly websocketAllowedOrigins: readonly string[];
}

export interface ConfigEnvironment {
  readonly [key: string]: string | undefined;
}

const DEFAULT_CONFIG: AppConfig = {
  host: "127.0.0.1",
  port: 5178,
  databasePath: resolve(process.cwd(), "data", "claude-code-anywhere.sqlite"),
  repositoryMode: "sqlite",
  tlsMode: "off",
  trustReverseProxy: false,
  outputBufferBytes: 1024 * 1024,
  heartbeatIntervalMs: 15_000,
  heartbeatTimeoutMs: 45_000,
  websocketPath: "/ws",
  websocketAllowedOrigins: [],
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
  if (value === undefined || value.trim() === "" || value === "off") {
    return DEFAULT_CONFIG.tlsMode;
  }

  if (value === "self-signed" || value === "provided") {
    throw new Error(`CCA_TLS_MODE=${value} is not supported; terminate TLS at a trusted reverse proxy`);
  }

  throw new Error("CCA_TLS_MODE must be off");
}

function readBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${name} must be true or false`);
}

function readTlsTerminationPath(value: string | undefined, name: string): void {
  if (value !== undefined && value.trim() !== "") {
    throw new Error(`${name} is not supported; terminate TLS at a trusted reverse proxy`);
  }
}

function readRepositoryMode(value: string | undefined): RepositoryMode {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_CONFIG.repositoryMode;
  }

  if (value === "sqlite" || value === "memory") {
    return value;
  }

  throw new Error("CCA_REPOSITORY_MODE must be sqlite or memory");
}

function readWebSocketPath(value: string | undefined): string {
  const path = value?.trim() || DEFAULT_CONFIG.websocketPath;
  if (!path.startsWith("/")) {
    throw new Error("CCA_WEBSOCKET_PATH must start with /");
  }
  return path;
}

function readWebSocketAllowedOrigins(value: string | undefined): readonly string[] {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_CONFIG.websocketAllowedOrigins;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
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
  const repositoryMode = readRepositoryMode(env.CCA_REPOSITORY_MODE);
  const tlsMode = readTlsMode(env.CCA_TLS_MODE);
  readTlsTerminationPath(env.CCA_TLS_CERT_PATH, "CCA_TLS_CERT_PATH");
  readTlsTerminationPath(env.CCA_TLS_KEY_PATH, "CCA_TLS_KEY_PATH");
  const trustReverseProxy = readBoolean(
    env.CCA_TRUST_REVERSE_PROXY,
    DEFAULT_CONFIG.trustReverseProxy,
    "CCA_TRUST_REVERSE_PROXY",
  );
  if (env.NODE_ENV === "production" && tlsMode === "off" && !trustReverseProxy) {
    throw new Error("CCA_TLS_MODE=off is only allowed in production when CCA_TRUST_REVERSE_PROXY=true");
  }
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
  const websocketPath = readWebSocketPath(env.CCA_WEBSOCKET_PATH);
  const websocketAllowedOrigins = readWebSocketAllowedOrigins(env.CCA_WEBSOCKET_ALLOWED_ORIGINS);

  return {
    host,
    port,
    databasePath,
    repositoryMode,
    tlsMode,
    trustReverseProxy,
    outputBufferBytes,
    heartbeatIntervalMs,
    heartbeatTimeoutMs,
    websocketPath,
    websocketAllowedOrigins,
  };
}

export const config = loadConfig();
