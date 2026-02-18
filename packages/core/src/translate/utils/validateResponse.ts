import { apiError } from '../../logging/errors';
import { ApiError } from '../../errors/ApiError';

export default async function validateResponse(response: Response) {
  if (!response.ok) {
    let errorMsg = 'Unknown error';
    try {
      const text = await response.text();
      try {
        const errorJson = JSON.parse(text) as { error: string };
        errorMsg = errorJson.error;
      } catch {
        errorMsg = text || 'Unknown error';
      }
    } catch {
      // response.text() failed, keep 'Unknown error'
    }
    const errorMessage = apiError(
      response.status,
      response.statusText,
      errorMsg
    );
    const error = new ApiError(errorMessage, response.status, errorMsg);
    throw error;
  }
}
