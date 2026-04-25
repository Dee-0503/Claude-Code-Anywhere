export const CLIENT_MESSAGE_TYPES = {
  INPUT: "input",
  ACK_OUTPUT: "ack_output",
  HEARTBEAT: "heartbeat",
} as const;

export const SERVER_MESSAGE_TYPES = {
  HELLO: "hello",
  OUTPUT: "output",
  OUTPUT_GAP: "output_gap",
  INPUT_ACK: "input_ack",
  QUEUED_INPUTS: "queued_inputs",
  PRESENCE: "presence",
  CONNECTION_STATE: "connection_state",
  ERROR: "error",
} as const;

export const WEBSOCKET_MESSAGE_TYPES = {
  ...CLIENT_MESSAGE_TYPES,
  ...SERVER_MESSAGE_TYPES,
} as const;

export type ClientMessageType =
  (typeof CLIENT_MESSAGE_TYPES)[keyof typeof CLIENT_MESSAGE_TYPES];

export type ServerMessageType =
  (typeof SERVER_MESSAGE_TYPES)[keyof typeof SERVER_MESSAGE_TYPES];

export type WebSocketMessageType = ClientMessageType | ServerMessageType;

export interface WebSocketConnectionParams {
  device_id: string;
  access_token: string;
  instance_id: string;
  last_output_offset: number;
}

export interface InputMessagePayload {
  type: typeof CLIENT_MESSAGE_TYPES.INPUT;
  instance_id: string;
  input_id: string;
  payload: string;
}

export interface AckOutputMessagePayload {
  type: typeof CLIENT_MESSAGE_TYPES.ACK_OUTPUT;
  instance_id: string;
  offset: number;
}

export interface HeartbeatMessagePayload {
  type: typeof CLIENT_MESSAGE_TYPES.HEARTBEAT;
  sent_at: string;
}

export interface HelloMessagePayload {
  type: typeof SERVER_MESSAGE_TYPES.HELLO;
  server_id: string;
  instance_id: string;
  connection_id: string;
  next_output_offset: number;
}

export interface OutputMessagePayload {
  type: typeof SERVER_MESSAGE_TYPES.OUTPUT;
  instance_id: string;
  offset: number;
  data: string;
}

export interface OutputGapMessagePayload {
  type: typeof SERVER_MESSAGE_TYPES.OUTPUT_GAP;
  instance_id: string;
  requested_offset: number;
  available_from_offset: number;
}

export const INPUT_ACK_STATUSES = {
  ACCEPTED: "accepted",
  DUPLICATE: "duplicate",
  REJECTED: "rejected",
} as const;

export type InputAckStatus =
  (typeof INPUT_ACK_STATUSES)[keyof typeof INPUT_ACK_STATUSES];

export interface InputAckMessagePayload {
  type: typeof SERVER_MESSAGE_TYPES.INPUT_ACK;
  instance_id: string;
  input_id: string;
  status: InputAckStatus;
}

export interface QueuedInputMessagePayload {
  type: typeof SERVER_MESSAGE_TYPES.QUEUED_INPUTS;
  instance_id: string;
  inputs: Array<{
    input_id: string;
    device_id: string;
    payload: string;
    status: "queued" | "cancelled";
  }>;
}

export interface PresenceMessagePayload {
  type: typeof SERVER_MESSAGE_TYPES.PRESENCE;
  instance_id: string;
  devices: Array<{
    device_id: string;
    connection_id: string;
  }>;
}

export const CONNECTION_STATES = {
  CONNECTED: "connected",
  DEGRADED: "degraded",
  DISCONNECTED: "disconnected",
} as const;

export type ConnectionState =
  (typeof CONNECTION_STATES)[keyof typeof CONNECTION_STATES];

export interface ConnectionStateMessagePayload {
  type: typeof SERVER_MESSAGE_TYPES.CONNECTION_STATE;
  state: ConnectionState;
}

export type ClientToServerMessage =
  | InputMessagePayload
  | AckOutputMessagePayload
  | HeartbeatMessagePayload;

export type ServerToClientMessage =
  | HelloMessagePayload
  | OutputMessagePayload
  | OutputGapMessagePayload
  | InputAckMessagePayload
  | QueuedInputMessagePayload
  | PresenceMessagePayload
  | ConnectionStateMessagePayload
  | ErrorMessagePayload;

export interface ErrorMessagePayload {
  type: typeof SERVER_MESSAGE_TYPES.ERROR;
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export type WebSocketMessage = ClientToServerMessage | ServerToClientMessage;
