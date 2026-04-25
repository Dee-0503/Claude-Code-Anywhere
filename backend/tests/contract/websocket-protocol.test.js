import { describe, expect, it } from "vitest";
import { CLIENT_MESSAGE_TYPES, SERVER_MESSAGE_TYPES, } from "../../../shared/protocol/messages.js";
import { createWebSocketProtocolService } from "../../src/api/websocket-protocol.js";
const connectionParams = {
    device_id: "device-id",
    access_token: "secret-token",
    instance_id: "instance-id",
    last_output_offset: 0,
};
describe("websocket protocol contract", () => {
    it("requires authenticated connection fields before attaching to an instance", async () => {
        const protocol = createWebSocketProtocolService();
        await expect(protocol.acceptConnection({
            device_id: "device-id",
            access_token: "secret-token",
            instance_id: "instance-id",
        })).rejects.toMatchObject({ code: "INVALID_WEBSOCKET_HANDSHAKE" });
        await expect(protocol.acceptConnection(connectionParams)).resolves.toMatchObject({
            type: SERVER_MESSAGE_TYPES.HELLO,
            server_id: expect.any(String),
            instance_id: "instance-id",
            connection_id: expect.any(String),
            next_output_offset: expect.any(Number),
        });
    });
    it("serializes hello, output, ack_output, and output_gap with the contract field names", () => {
        const protocol = createWebSocketProtocolService();
        expect(protocol.serializeHello({
            serverId: "local-server-id",
            instanceId: "instance-id",
            connectionId: "connection-id",
            nextOutputOffset: 1234,
        })).toEqual({
            type: SERVER_MESSAGE_TYPES.HELLO,
            server_id: "local-server-id",
            instance_id: "instance-id",
            connection_id: "connection-id",
            next_output_offset: 1234,
        });
        expect(protocol.serializeOutput({
            instanceId: "instance-id",
            offset: 1234,
            data: "ansi encoded terminal bytes as utf-8 string",
        })).toEqual({
            type: SERVER_MESSAGE_TYPES.OUTPUT,
            instance_id: "instance-id",
            offset: 1234,
            data: "ansi encoded terminal bytes as utf-8 string",
        });
        expect(protocol.parseClientMessage(JSON.stringify({
            type: CLIENT_MESSAGE_TYPES.ACK_OUTPUT,
            instance_id: "instance-id",
            offset: 2048,
        }))).toEqual({
            type: CLIENT_MESSAGE_TYPES.ACK_OUTPUT,
            instance_id: "instance-id",
            offset: 2048,
        });
        expect(protocol.serializeOutputGap({
            instanceId: "instance-id",
            requestedOffset: 100,
            availableFromOffset: 900,
        })).toEqual({
            type: SERVER_MESSAGE_TYPES.OUTPUT_GAP,
            instance_id: "instance-id",
            requested_offset: 100,
            available_from_offset: 900,
        });
    });
    it("replays buffered output from last_output_offset or emits output_gap when history was evicted", async () => {
        const protocol = createWebSocketProtocolService({ outputBufferBytes: 16 });
        await protocol.appendOutput("instance-id", "01234567");
        await protocol.appendOutput("instance-id", "89abcdef");
        await expect(protocol.acceptConnection({
            ...connectionParams,
            last_output_offset: 8,
        })).resolves.toMatchObject({
            replay: [
                {
                    type: SERVER_MESSAGE_TYPES.OUTPUT,
                    instance_id: "instance-id",
                    offset: 8,
                    data: "89abcdef",
                },
            ],
        });
        await protocol.appendOutput("instance-id", "ghijklmnopqrstuvwxyz");
        await expect(protocol.acceptConnection({
            ...connectionParams,
            last_output_offset: 1,
        })).resolves.toMatchObject({
            replay: [
                {
                    type: SERVER_MESSAGE_TYPES.OUTPUT_GAP,
                    instance_id: "instance-id",
                    requested_offset: 1,
                    available_from_offset: expect.any(Number),
                },
            ],
        });
    });
});
//# sourceMappingURL=websocket-protocol.test.js.map