export function createLogger(name: string) {
  return {
    info: (...args: unknown[]) => console.info(`[${name}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[${name}]`, ...args),
    error: (...args: unknown[]) => console.error(`[${name}]`, ...args),
    debug: (...args: unknown[]) => console.debug(`[${name}]`, ...args),
  };
}

export const logger = createLogger('marketing');
