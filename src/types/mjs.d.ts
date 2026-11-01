declare module "*.mjs" {
  export const analyzeSemanticFrames: (...args: unknown[]) => Promise<unknown>;
  export const summarizeParticipantV3: (...args: unknown[]) => unknown;
}
