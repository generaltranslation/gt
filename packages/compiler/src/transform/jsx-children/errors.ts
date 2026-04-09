export type JsxValidationError = {
  level: 'error' | 'warning';
  type: 'dynamic-content' | 'structural';
  message: string;
};

export function dynamicContentError(message: string): JsxValidationError {
  return { level: 'error', type: 'dynamic-content', message };
}

export function structuralError(message: string): JsxValidationError {
  return { level: 'error', type: 'structural', message };
}
