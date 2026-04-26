import { SERVER_MESSAGE_TYPES, type OutputMessagePayload } from "../../../shared/protocol/messages.js";

export interface TerminalOutputWriter {
  write(data: string): void;
}

export interface TerminalOutputState {
  readonly text: string;
  readonly scrollOffset: number;
  readonly maxLength: number;
}

export function appendTerminalOutput(
  state: TerminalOutputState,
  message: OutputMessagePayload,
  writer: TerminalOutputWriter | null,
): TerminalOutputState {
  if (message.type !== SERVER_MESSAGE_TYPES.OUTPUT) {
    return state;
  }

  writer?.write(message.data);
  const nextText = `${state.text}${message.data}`;
  const trimmedText = nextText.slice(-state.maxLength);

  return {
    ...state,
    text: trimmedText,
    scrollOffset: nextText.length - trimmedText.length,
  };
}
