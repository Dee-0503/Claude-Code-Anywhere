import { describe, expect, it } from "vitest";
import { BoundedOutputBuffer } from "../../src/sessions/output-buffer.js";
const INSTANCE_ID = "instance-id";
const MB = 1024 * 1024;
describe("BoundedOutputBuffer", () => {
    it("assigns monotonic byte offsets and replays output from a persisted offset", () => {
        const buffer = new BoundedOutputBuffer(INSTANCE_ID, MB);
        buffer.append("hello");
        buffer.append(" world");
        expect(buffer.snapshot).toMatchObject({
            instanceId: INSTANCE_ID,
            baseOffset: 0,
            nextOffset: 11,
            capacityBytes: MB,
        });
        expect(buffer.replayFrom(6)).toEqual([
            expect.objectContaining({
                instanceId: INSTANCE_ID,
                offset: 6,
                nextOffset: 11,
                data: "world",
            }),
        ]);
    });
    it("returns null for replay when the requested offset is older than the retained 1MB window", () => {
        const buffer = new BoundedOutputBuffer(INSTANCE_ID, MB);
        buffer.append("a".repeat(MB));
        buffer.append("b");
        expect(buffer.snapshot.baseOffset).toBe(MB);
        expect(buffer.snapshot.nextOffset).toBe(MB + 1);
        expect(buffer.replayFrom(0)).toBeNull();
        expect(buffer.replayFrom(MB)).toEqual([
            expect.objectContaining({
                offset: MB,
                nextOffset: MB + 1,
                data: "b",
            }),
        ]);
    });
    it("clears retained chunks without rewinding the next output offset", () => {
        const buffer = new BoundedOutputBuffer(INSTANCE_ID, MB);
        buffer.append("first");
        buffer.clear();
        buffer.append("second");
        expect(buffer.snapshot).toMatchObject({
            baseOffset: 5,
            nextOffset: 11,
            chunks: [
                expect.objectContaining({
                    offset: 5,
                    nextOffset: 11,
                    data: "second",
                }),
            ],
        });
    });
    it("rejects invalid replay offsets", () => {
        const buffer = new BoundedOutputBuffer(INSTANCE_ID, MB);
        expect(() => buffer.replayFrom(-1)).toThrow("Replay offset must be a non-negative integer");
        expect(() => buffer.replayFrom(1.5)).toThrow("Replay offset must be a non-negative integer");
    });
});
//# sourceMappingURL=output-buffer.test.js.map