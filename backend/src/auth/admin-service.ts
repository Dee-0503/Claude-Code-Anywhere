import { DEVICE_ROLES, type Device, type DeviceId } from '../../../shared/protocol/domain.js';
import { createApiError } from '../api/errors.js';
import type { BootstrapPairingService } from './pairing-service.js';
import type { DeviceRepository } from './device-repository.js';

export interface AdminServiceOptions {
  readonly auth: BootstrapPairingService;
  readonly devices: DeviceRepository;
  readonly now?: () => Date;
}

export interface AdminAuthenticatedRequest {
  readonly admin_device_id: DeviceId;
  readonly access_token: string;
}

export interface TargetDeviceRequest extends AdminAuthenticatedRequest {
  readonly target_device_id: DeviceId;
}

function adminError(code: string, message: string): Error & { code: string } {
  return createApiError(code as never, message) as Error & { code: string };
}

export function createAdminService(options: AdminServiceOptions) {
  const now = options.now ?? (() => new Date());

  async function authenticateAdmin(input: AdminAuthenticatedRequest): Promise<Device> {
    const admin = await options.auth.verifyDeviceToken({
      device_id: input.admin_device_id,
      access_token: input.access_token
    });
    if (admin.role !== DEVICE_ROLES.ADMIN) {
      throw adminError('ADMIN_REQUIRED', 'Admin device required');
    }
    return admin;
  }

  return {
    async listDevices(input: AdminAuthenticatedRequest) {
      await authenticateAdmin(input);
      return options.devices.list();
    },
    async revokeDevice(input: TargetDeviceRequest) {
      await authenticateAdmin(input);
      options.devices.revoke(input.target_device_id, now().toISOString());
      return { revoked: true };
    },
    async transferAdmin(input: TargetDeviceRequest) {
      await authenticateAdmin(input);
      const target = options.devices.getById(input.target_device_id);
      if (target === undefined || target.revokedAt !== null) {
        throw adminError('INVALID_DEVICE_TOKEN', 'Target device is not active');
      }
      for (const device of options.devices.list()) {
        if (device.role === DEVICE_ROLES.ADMIN) {
          options.devices.updateRole(device.id, DEVICE_ROLES.MEMBER);
        }
      }
      options.devices.updateRole(input.target_device_id, DEVICE_ROLES.ADMIN);
      return { new_admin_device_id: input.target_device_id };
    }
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
