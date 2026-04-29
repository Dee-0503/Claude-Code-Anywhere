export interface SpeechInputAdapterOptions {
  readonly available: boolean;
  readonly start?: () => Promise<string>;
}

export interface SpeechInputAdapter {
  readonly available: boolean;
  start(): Promise<string>;
}

export function createSpeechInputAdapter(options: SpeechInputAdapterOptions): SpeechInputAdapter {
  return {
    available: options.available,
    async start() {
      if (!options.available || options.start === undefined) {
        throw new Error('Speech input is unavailable');
      }
      return options.start();
    }
  };
}
