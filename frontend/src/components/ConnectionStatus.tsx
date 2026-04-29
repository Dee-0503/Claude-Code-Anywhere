import type { ReactElement } from 'react';

import type { ConnectionState } from '../../../shared/protocol/messages.js';
import type { ProtocolClientStatus } from '../protocol/client.js';

export type DisplayConnectionState = ConnectionState | 'reconnecting' | ProtocolClientStatus;

export function renderConnectionStatus(state: DisplayConnectionState): string {
  switch (state) {
    case 'open':
    case 'connected':
      return '连接正常';
    case 'degraded':
      return '网络较弱，输入将自动重试。';
    case 'disconnected':
    case 'closed':
      return '连接已断开，离线输入会等待确认。';
    case 'connecting':
    case 'reconnecting':
      return '正在重连，请稍候。';
    case 'error':
      return '连接异常，请检查网络。';
    case 'idle':
      return '等待连接。';
  }
}

export interface ConnectionStatusProps {
  readonly state: DisplayConnectionState;
}

export function ConnectionStatus({ state }: ConnectionStatusProps): ReactElement {
  return <p role="status">{renderConnectionStatus(state)}</p>;
}
