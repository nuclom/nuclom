import { AssemblyAI } from 'assemblyai';
import { Context, Effect, Layer } from 'effect';

export interface AssemblyAIClientService {
  create: (apiKey: string) => Effect.Effect<AssemblyAI, never>;
}

export class AssemblyAIClient extends Context.Tag('AssemblyAIClient')<AssemblyAIClient, AssemblyAIClientService>() {}

const makeAssemblyAIClient = Effect.sync(
  (): AssemblyAIClientService => ({
    create: (apiKey) => Effect.sync(() => new AssemblyAI({ apiKey })),
  }),
);

export const AssemblyAIClientLive = Layer.effect(AssemblyAIClient, makeAssemblyAIClient);
