import {
  SERVER_MESSAGE_TYPES,
  type OutputMessagePayload
} from '../../../shared/protocol/messages.js';

export interface TerminalOutputWriter {
  write(data: string): void;
}

export interface TerminalOutputScroller {
  scrollToLine(line: number): void;
}

export interface TerminalOutputState {
  readonly chunks: readonly string[];
  readonly visibleLength: number;
  readonly scrollOffset: number;
  readonly maxLength: number;
}

export function appendTerminalOutput(
  state: TerminalOutputState,
  message: OutputMessagePayload,
  writer: TerminalOutputWriter | null
): TerminalOutputState {
  if (message.type !== SERVER_MESSAGE_TYPES.OUTPUT) {
    return state;
  }

  writer?.write(message.data);
  const chunks = [...state.chunks, message.data];
  let visibleLength = state.visibleLength + message.data.length;
  let scrollOffset = state.scrollOffset;

  while (chunks.length > 0) {
    const firstChunk = chunks[0];
    if (firstChunk === undefined || visibleLength - firstChunk.length < state.maxLength) {
      break;
    }

    chunks.shift();
    visibleLength -= firstChunk.length;
    scrollOffset += firstChunk.length;
  }

  if (visibleLength > state.maxLength) {
    const firstChunk = chunks[0];
    if (firstChunk !== undefined) {
      const overflow = visibleLength - state.maxLength;
      chunks[0] = firstChunk.slice(overflow);
      visibleLength -= overflow;
      scrollOffset += overflow;
    }
  }

  return {
    ...state,
    chunks,
    visibleLength,
    scrollOffset
  };
}

export function getTerminalOutputText(state: TerminalOutputState): string {
  return state.chunks.join('');
}

export function scrollTerminalOutput(
  state: TerminalOutputState,
  scroller: TerminalOutputScroller | null,
  outputOffset: number
): void {
  if (outputOffset < state.scrollOffset) {
    scroller?.scrollToLine(0);
    return;
  }

  const visibleOffset = outputOffset - state.scrollOffset;
  const line = getTerminalOutputText(state).slice(0, visibleOffset).split('\n').length - 1;
  scroller?.scrollToLine(line);
}
