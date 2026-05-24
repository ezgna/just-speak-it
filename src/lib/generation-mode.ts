export type GenerationMode = 'natural' | 'compact';

export function isGenerationMode(value: string | null): value is GenerationMode {
  return value === 'natural' || value === 'compact';
}
