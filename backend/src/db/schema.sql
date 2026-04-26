PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT,
  revoked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_token_hash ON devices(token_hash);
CREATE INDEX IF NOT EXISTS idx_devices_role ON devices(role);

CREATE TABLE IF NOT EXISTS pairing_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  created_by_device_id TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by_device_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by_device_id) REFERENCES devices(id) ON DELETE SET NULL,
  FOREIGN KEY (used_by_device_id) REFERENCES devices(id) ON DELETE SET NULL,
  CHECK (used_at IS NULL OR used_by_device_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_pairing_codes_expires_at ON pairing_codes(expires_at);

CREATE TABLE IF NOT EXISTS pairing_attempts (
  key TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TEXT,
  last_failed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pairing_attempts_locked_until ON pairing_attempts(locked_until);

CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('idle', 'running', 'exited', 'error')),
  pty_pid INTEGER,
  cwd TEXT NOT NULL,
  created_by_device_id TEXT,
  team_metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at TEXT,
  exited_at TEXT,
  FOREIGN KEY (created_by_device_id) REFERENCES devices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);
CREATE INDEX IF NOT EXISTS idx_instances_created_by_device_id ON instances(created_by_device_id);

CREATE TABLE IF NOT EXISTS input_messages (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'injected', 'acked', 'cancelled', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  injected_at TEXT,
  acked_at TEXT,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_input_messages_instance_status_created ON input_messages(instance_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_input_messages_device_id ON input_messages(device_id);

CREATE TABLE IF NOT EXISTS connections (
  connection_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('connected', 'degraded', 'disconnected')),
  last_acked_output_offset INTEGER NOT NULL DEFAULT 0 CHECK (last_acked_output_offset >= 0),
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_heartbeat_at TEXT,
  disconnected_at TEXT,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_connections_device_id ON connections(device_id);
CREATE INDEX IF NOT EXISTS idx_connections_instance_state ON connections(instance_id, state);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  device_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('permission_request', 'long_running_complete', 'error', 'mention', 'input_required')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'read', 'escalated', 'expired')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT,
  read_at TEXT,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_instance_status_created ON notifications(instance_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_priority_status ON notifications(priority, status);
