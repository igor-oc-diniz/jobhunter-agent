// Shared contract for CV generation feature

export interface GenerateCVRequest {
  userId: string;
  jobId: string;
}

export interface GenerateCVSuccess {
  pdfUrl: string;
  generatedAt: string;
}

export interface GenerateCVError {
  error: string;
}

export type GenerateCVResult = GenerateCVSuccess | GenerateCVError;

export function isGenerateCVSuccess(result: GenerateCVResult): result is GenerateCVSuccess {
  return 'pdfUrl' in result;
}

export function isGenerateCVError(result: GenerateCVResult): result is GenerateCVError {
  return 'error' in result;
}

export interface CVGenerationState {
  isGenerating: boolean;
  result: GenerateCVSuccess | null;
  error: string | null;
}
