import type { DeviceId } from '../../../shared/protocol/domain.js';
import type { AdminService } from '../auth/admin-service.js';

export interface DeviceApiOptions {
  readonly admin: AdminService;
}

export interface AuthenticatedDeviceManagementRequest {
  readonly device_id: string;
  readonly access_token: string;
}

export interface AdminDeviceRequest {
  readonly admin_device_id: DeviceId;
  readonly access_token: string;
}

export interface TargetDeviceRequest extends AdminDeviceRequest {
  readonly target_device_id: DeviceId;
}

export function createDeviceApi(options: DeviceApiOptions) {
  return {
    async listDevices(input: AuthenticatedDeviceManagementRequest) {
      const devices = await options.admin.listDevices({
        admin_device_id: input.device_id,
        access_token: input.access_token
      });
      return {
        devices: devices.map((device) => ({
          id: device.id,
          name: device.name,
          role: device.role,
          created_at: device.createdAt,
          last_seen_at: device.lastSeenAt,
          revoked_at: device.revokedAt
        }))
      };
    },
    async revokeDevice(input: TargetDeviceRequest) {
      return options.admin.revokeDevice(input);
    },
    async transferAdmin(input: TargetDeviceRequest) {
      return options.admin.transferAdmin(input);
    }
  };
}
