import { apiError } from '../../logging/errors';
import { ApiError } from '../../errors/ApiError';

export default async function validateResponse(response: Response) {
  if (!response.ok) {
    let errorMsg = 'Unknown error';
    try {
      const errorJson = (await response.json()) as { error: string };
      errorMsg = errorJson.error;
    } catch {
      errorMsg = 'Failed to read response body';
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
