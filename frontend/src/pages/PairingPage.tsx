import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import {
  fetchPairingCredentials,
  saveDeviceCredentials,
  type DeviceCredentials,
  type PairingHandler
} from '../protocol/device-credentials.js';

export interface PairingPageProps {
  readonly onPaired?: (credentials: DeviceCredentials) => void;
  readonly pairingHandler?: PairingHandler;
}

export function PairingPage({
  onPaired,
  pairingHandler = fetchPairingCredentials
}: PairingPageProps): ReactElement {
  const [pairingCode, setPairingCode] = useState('');
  const [deviceName, setDeviceName] = useState(() => window.navigator.userAgent.slice(0, 48));
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('输入本机终端显示的配对码以信任此设备。');

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus('submitting');
    setMessage('正在配对设备...');

    try {
      const credentials = await pairingHandler({
        pairing_code: pairingCode.trim(),
        device_name: deviceName.trim()
      });
      saveDeviceCredentials(credentials);
      setStatus('success');
      setMessage('配对成功，设备凭据已保存到此浏览器。');
      onPaired?.(credentials);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '配对失败，请检查配对码后重试。');
    }
  }

  return (
    <form aria-label="设备配对" onSubmit={(event) => void handleSubmit(event)}>
      <p>{message}</p>

      <label>
        配对码
        <input
          autoComplete="one-time-code"
          name="pairing_code"
          onChange={(event) => setPairingCode(event.target.value)}
          placeholder="123-456"
          required
          value={pairingCode}
        />
      </label>

      <label>
        设备名称
        <input
          autoComplete="nickname"
          name="device_name"
          onChange={(event) => setDeviceName(event.target.value)}
          required
          value={deviceName}
        />
      </label>

      <button disabled={status === 'submitting'} type="submit">
        {status === 'submitting' ? '配对中...' : '保存设备凭据'}
      </button>
    </form>
  );
}
