import { SERVER_MESSAGE_TYPES, type OutputMessagePayload } from "../../../shared/protocol/messages.js";

export interface TerminalOutputWriter {
  write(data: string): void;
}

export interface TerminalOutputScroller {
  scrollToLine(line: number): void;
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

export function scrollTerminalOutput(state: TerminalOutputState, scroller: TerminalOutputScroller | null, outputOffset: number): void {
  if (outputOffset < state.scrollOffset) {
    scroller?.scrollToLine(0);
    return;
  }

  const visibleOffset = outputOffset - state.scrollOffset;
  const line = state.text.slice(0, visibleOffset).split("\n").length - 1;
  scroller?.scrollToLine(line);
}
