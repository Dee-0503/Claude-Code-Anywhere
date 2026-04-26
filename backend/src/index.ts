import { createDeviceApi } from "./api/device-routes.js";
import { createInstanceApi } from "./api/instance-routes.js";
import { createAdminService } from "./auth/admin-service.js";
import { createInMemoryDeviceRepository, createSqliteDeviceRepository } from "./auth/device-repository.js";
import { createBootstrapPairingService } from "./auth/pairing-service.js";
import { createInMemoryPairingRepository, createSqlitePairingRepository } from "./auth/pairing-repository.js";
import { config, type AppConfig } from "./config.js";
import { openDatabaseConnection, type SqliteDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrations.js";
import { createInMemoryNotificationRepository, createSqliteNotificationRepository } from "./notifications/notification-repository.js";
import { createNotificationService } from "./notifications/notification-service.js";
import { createInMemoryInstanceRepository, createSqliteInstanceRepository } from "./sessions/instance-repository.js";
import { createInstanceService } from "./sessions/instance-service.js";

export interface RuntimeServices {
  readonly database: SqliteDatabase | null;
  readonly auth: ReturnType<typeof createBootstrapPairingService>;
  readonly admin: ReturnType<typeof createAdminService>;
  readonly devices: ReturnType<typeof createDeviceApi>;
  readonly instances: ReturnType<typeof createInstanceService>;
  readonly instanceApi: ReturnType<typeof createInstanceApi>;
  readonly notifications: ReturnType<typeof createNotificationService>;
}

export function createRuntimeServices(appConfig: AppConfig = config): RuntimeServices {
  const database = appConfig.repositoryMode === "sqlite"
    ? openDatabaseConnection({ path: appConfig.databasePath })
    : null;

  if (database !== null) {
    runMigrations(database);
  }

  const deviceRepository = database === null
    ? createInMemoryDeviceRepository()
    : createSqliteDeviceRepository(database);
  const pairingRepository = database === null
    ? createInMemoryPairingRepository()
    : createSqlitePairingRepository(database);
  const instanceRepository = database === null
    ? createInMemoryInstanceRepository()
    : createSqliteInstanceRepository(database);
  const notificationRepository = database === null
    ? createInMemoryNotificationRepository()
    : createSqliteNotificationRepository(database);

  const auth = createBootstrapPairingService({
    devices: deviceRepository,
    pairings: pairingRepository,
  });
  const admin = createAdminService({ auth, devices: deviceRepository });
  const instances = createInstanceService({
    repository: instanceRepository,
    allowedWorkspaceRoots: appConfig.instanceAllowedWorkspaceRoots,
    maxActiveInstancesPerDevice: appConfig.instanceMaxActivePerDevice,
    maxActiveInstancesGlobal: appConfig.instanceMaxActiveGlobal,
  });
  const notifications = createNotificationService({ notifications: notificationRepository });

  return {
    database,
    auth,
    admin,
    devices: createDeviceApi({ admin }),
    instances,
    instanceApi: createInstanceApi({ auth, instances }),
    notifications,
  };
}

export const runtime = createRuntimeServices();
