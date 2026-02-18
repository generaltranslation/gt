import { apiError } from '../../logging/errors';
import { ApiError } from '../../errors/ApiError';

export default async function validateResponse(response: Response) {
  if (!response.ok) {
    const errorJson = (await response.json()) as { error: string };
    const errorMsg = errorJson.error;
    const errorMessage = apiError(
      response.status,
      response.statusText,
      errorMsg
    );
    const error = new ApiError(errorMessage, response.status, errorMsg);
    throw error;
  }
}
