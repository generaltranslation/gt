import { apiError } from '../../logging/errors';
import { ApiError } from '../../errors/ApiError';

export default async function validateResponse(response: Response) {
  if (!response.ok) {
    const errorText = await response.text();
    const errorMessage = apiError(
      response.status,
      response.statusText,
      errorText
    );
    const error = new ApiError(errorMessage, response.status, errorText);
    throw error;
  }
}
