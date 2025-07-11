import { translationApiError } from '../../logging/errors';
import { fetchLogger } from '../../logging/logger';

export default async function validateResponse(response: Response) {
  if (!response.ok) {
    const errorText = await response.text();
    const errorMessage = translationApiError(
      response.status,
      response.statusText,
      errorText
    );
    fetchLogger.error(errorMessage, {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });
    throw new Error(errorMessage);
  }
}
