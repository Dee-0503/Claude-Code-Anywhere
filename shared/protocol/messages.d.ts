export declare const CLIENT_MESSAGE_TYPES: {
    readonly INPUT: "input";
    readonly ACK_OUTPUT: "ack_output";
    readonly HEARTBEAT: "heartbeat";
};
export declare const SERVER_MESSAGE_TYPES: {
    readonly HELLO: "hello";
    readonly OUTPUT: "output";
    readonly OUTPUT_GAP: "output_gap";
    readonly INPUT_ACK: "input_ack";
    readonly CONNECTION_STATE: "connection_state";
    readonly ERROR: "error";
};
export declare const WEBSOCKET_MESSAGE_TYPES: {
    readonly HELLO: "hello";
    readonly OUTPUT: "output";
    readonly OUTPUT_GAP: "output_gap";
    readonly INPUT_ACK: "input_ack";
    readonly CONNECTION_STATE: "connection_state";
    readonly ERROR: "error";
    readonly INPUT: "input";
    readonly ACK_OUTPUT: "ack_output";
    readonly HEARTBEAT: "heartbeat";
};
export type ClientMessageType = (typeof CLIENT_MESSAGE_TYPES)[keyof typeof CLIENT_MESSAGE_TYPES];
export type ServerMessageType = (typeof SERVER_MESSAGE_TYPES)[keyof typeof SERVER_MESSAGE_TYPES];
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
export declare const INPUT_ACK_STATUSES: {
    readonly ACCEPTED: "accepted";
    readonly DUPLICATE: "duplicate";
    readonly REJECTED: "rejected";
};
export type InputAckStatus = (typeof INPUT_ACK_STATUSES)[keyof typeof INPUT_ACK_STATUSES];
export interface InputAckMessagePayload {
    type: typeof SERVER_MESSAGE_TYPES.INPUT_ACK;
    instance_id: string;
    input_id: string;
    status: InputAckStatus;
}
export declare const CONNECTION_STATES: {
    readonly CONNECTED: "connected";
    readonly DEGRADED: "degraded";
    readonly DISCONNECTED: "disconnected";
};
export type ConnectionState = (typeof CONNECTION_STATES)[keyof typeof CONNECTION_STATES];
export interface ConnectionStateMessagePayload {
    type: typeof SERVER_MESSAGE_TYPES.CONNECTION_STATE;
    state: ConnectionState;
}
export type ClientToServerMessage = InputMessagePayload | AckOutputMessagePayload | HeartbeatMessagePayload;
export type ServerToClientMessage = HelloMessagePayload | OutputMessagePayload | OutputGapMessagePayload | InputAckMessagePayload | ConnectionStateMessagePayload | ErrorMessagePayload;
export interface ErrorMessagePayload {
    type: typeof SERVER_MESSAGE_TYPES.ERROR;
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
}
export type WebSocketMessage = ClientToServerMessage | ServerToClientMessage;
//# sourceMappingURL=messages.d.ts.map