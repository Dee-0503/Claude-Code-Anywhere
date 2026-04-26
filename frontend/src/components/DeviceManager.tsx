import type { ReactElement } from 'react';

export interface DeviceManagerItem {
  readonly id: string;
  readonly name: string;
  readonly role: 'admin' | 'member';
  readonly revokedAt: string | null;
}

export function renderDeviceManager(devices: readonly DeviceManagerItem[]): string {
  if (devices.length === 0) {
    return '暂无已配对设备。';
  }

  const activeDevices = devices.filter((device) => device.revokedAt === null);
  const admin = activeDevices.find((device) => device.role === 'admin');
  const revocable = activeDevices.filter((device) => device.role !== 'admin');
  const revoked = devices.filter((device) => device.revokedAt !== null);
  const revokedSummary = revoked.map((device) => `${device.name} 已撤销访问`).join('。');
  const revocableSummary =
    revocable.length === 0
      ? '无可撤销成员设备'
      : `可撤销：${revocable.map((device) => device.name).join('、')}`;

  return (
    [
      `${activeDevices.length} 台已配对设备`,
      `管理员：${admin?.name ?? '未设置'}`,
      revocableSummary,
      revokedSummary
    ]
      .filter(Boolean)
      .join('。') + '。'
  );
}

export interface DeviceManagerProps {
  readonly devices: readonly DeviceManagerItem[];
  readonly onRevoke?: (deviceId: string) => void;
  readonly onTransferAdmin?: (deviceId: string) => void;
}

export function DeviceManager({
  devices,
  onRevoke,
  onTransferAdmin
}: DeviceManagerProps): ReactElement {
  return (
    <section aria-label="设备管理">
      <p>{renderDeviceManager(devices)}</p>
      <ul>
        {devices.map((device) => (
          <li key={device.id}>
            {device.name}（{device.role}）
            {device.revokedAt === null && device.role !== 'admin' ? (
              <>
                <button type="button" onClick={() => onRevoke?.(device.id)}>
                  撤销
                </button>
                <button type="button" onClick={() => onTransferAdmin?.(device.id)}>
                  转移管理员
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
