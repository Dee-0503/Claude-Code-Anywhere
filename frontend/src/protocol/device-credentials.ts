export interface DeviceCredentials {
  readonly device_id: string;
  readonly access_token: string;
  readonly role?: string;
}

export interface PairingRequest {
  readonly pairing_code: string;
  readonly device_name: string;
}

export type PairingHandler = (request: PairingRequest) => Promise<DeviceCredentials>;

const DEVICE_CREDENTIALS_KEY = "cca.deviceCredentials";

function defaultPairingEndpoint(): string {
  return `${window.location.origin}/api/pairing/consume`;
}

export function saveDeviceCredentials(credentials: DeviceCredentials, storage: Storage = window.localStorage): void {
  storage.setItem(DEVICE_CREDENTIALS_KEY, JSON.stringify(credentials));
}

export function loadDeviceCredentials(storage: Storage = window.localStorage): DeviceCredentials | null {
  const raw = storage.getItem(DEVICE_CREDENTIALS_KEY);
  if (raw === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DeviceCredentials>;
    if (typeof parsed.device_id === "string" && typeof parsed.access_token === "string") {
      return typeof parsed.role === "string"
        ? {
            device_id: parsed.device_id,
            access_token: parsed.access_token,
            role: parsed.role,
          }
        : {
            device_id: parsed.device_id,
            access_token: parsed.access_token,
          };
    }
  } catch {
    storage.removeItem(DEVICE_CREDENTIALS_KEY);
  }

  return null;
}

export async function fetchPairingCredentials(request: PairingRequest): Promise<DeviceCredentials> {
  const response = await fetch(defaultPairingEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Pairing failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DeviceCredentials;
}
