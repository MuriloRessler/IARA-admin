import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

const unauthorized = (message = 'Authentication required') => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

const getBearerToken = (authorizationHeader) => {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] || null;
};

export const createAdminAuthMiddleware = ({
  supabaseClient = supabase,
  config = env,
} = {}) => async (request, _response, next) => {
  if (!config.adminUserId || !supabaseClient) {
    const error = new Error('Administrative authentication is not configured');
    error.statusCode = 503;
    next(error);
    return;
  }

  const token = getBearerToken(request.get('Authorization'));
  if (!token) {
    next(unauthorized());
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.getUser(token);

    if (error || !data?.user) {
      const authError = unauthorized('Invalid or expired authentication token');
      if (error && error.status && error.status >= 500) {
        authError.statusCode = 503;
        authError.message = 'Authentication service temporarily unavailable';
      }
      next(authError);
      return;
    }

    if (data.user.id !== config.adminUserId) {
      const errorResponse = new Error('Administrator access required');
      errorResponse.statusCode = 403;
      next(errorResponse);
      return;
    }

    request.admin = {
      id: data.user.id,
      email: data.user.email || null,
    };
    next();
  } catch (_error) {
    const serviceError = new Error('Authentication service temporarily unavailable');
    serviceError.statusCode = 503;
    next(serviceError);
  }
};
