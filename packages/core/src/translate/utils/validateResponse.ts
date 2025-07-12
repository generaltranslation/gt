import { apiError } from '../../logging/errors';
import { fetchLogger } from '../../logging/logger';

export default async function validateResponse(response: Response) {
  if (!response.ok) {
    const errorText = await response.text();
    const errorMessage = apiError(
      response.status,
      response.statusText,
      errorText
    );
    fetchLogger.error(errorMessage, {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });
    const error = new Error(errorMessage);
    (error as any).code = response.status;
    (error as any).message = errorText;
    throw error;
  }
}
