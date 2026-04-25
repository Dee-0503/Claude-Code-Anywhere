import type { Device, DeviceId } from "../../../shared/protocol/domain.js";
import { verifyToken } from "./tokens.js";

export interface DeviceRepository {
  create(device: Device): Device;
  list(): Device[];
  getById(deviceId: DeviceId): Device | undefined;
  hasActiveAdmin(): boolean;
  updateLastSeen(deviceId: DeviceId, lastSeenAt: string): Device | undefined;
  updateRole(deviceId: DeviceId, role: Device["role"]): Device | undefined;
  revoke(deviceId: DeviceId, revokedAt: string): Device | undefined;
  verifyToken(deviceId: DeviceId, accessToken: string): Promise<Device | undefined>;
}

export function createInMemoryDeviceRepository(): DeviceRepository {
  const devices = new Map<DeviceId, Device>();

  return {
    create(device) {
      devices.set(device.id, device);
      return device;
    },
    list() {
      return [...devices.values()];
    },
    getById(deviceId) {
      return devices.get(deviceId);
    },
    hasActiveAdmin() {
      for (const device of devices.values()) {
        if (device.role === "admin" && device.revokedAt === null) {
          return true;
        }
      }
      return false;
    },
    updateLastSeen(deviceId, lastSeenAt) {
      const device = devices.get(deviceId);
      if (device === undefined) return undefined;
      const updated = { ...device, lastSeenAt };
      devices.set(deviceId, updated);
      return updated;
    },
    updateRole(deviceId, role) {
      const device = devices.get(deviceId);
      if (device === undefined) return undefined;
      const updated = { ...device, role };
      devices.set(deviceId, updated);
      return updated;
    },
    revoke(deviceId, revokedAt) {
      const device = devices.get(deviceId);
      if (device === undefined) return undefined;
      const updated = { ...device, revokedAt };
      devices.set(deviceId, updated);
      return updated;
    },
    async verifyToken(deviceId, accessToken) {
      const device = devices.get(deviceId);
      if (device === undefined) return undefined;
      return (await verifyToken(accessToken, device.tokenHash)) ? device : undefined;
    },
  };
}
