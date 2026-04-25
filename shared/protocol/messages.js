export const CLIENT_MESSAGE_TYPES = {
    INPUT: "input",
    ACK_OUTPUT: "ack_output",
    HEARTBEAT: "heartbeat",
};
export const SERVER_MESSAGE_TYPES = {
    HELLO: "hello",
    OUTPUT: "output",
    OUTPUT_GAP: "output_gap",
    INPUT_ACK: "input_ack",
    CONNECTION_STATE: "connection_state",
    ERROR: "error",
};
export const WEBSOCKET_MESSAGE_TYPES = {
    ...CLIENT_MESSAGE_TYPES,
    ...SERVER_MESSAGE_TYPES,
};
export const INPUT_ACK_STATUSES = {
    ACCEPTED: "accepted",
    DUPLICATE: "duplicate",
    REJECTED: "rejected",
};
export const CONNECTION_STATES = {
    CONNECTED: "connected",
    DEGRADED: "degraded",
    DISCONNECTED: "disconnected",
};
//# sourceMappingURL=messages.js.map