import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// In production, require explicit secrets - no defaults allowed
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET must be set in production environment');
}

if (isProduction && !process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET must be set in production environment');
}

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'change-me-in-production';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'change-me-in-production';

// Access token expires in 1 hour
const ACCESS_TOKEN_EXPIRY = '1h';

// Refresh token expires in 7 days
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generate a pair of access and refresh tokens
 */
export function generateTokenPair(payload: TokenPayload): TokenPair {
  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: 'HS256',
  });

  const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    algorithm: 'HS256',
  });

  return { accessToken, refreshToken };
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET, {
      algorithms: ['HS256'],
    }) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET, {
      algorithms: ['HS256'],
    }) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Decode a token without verification (for debugging/logging)
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch (error) {
    return null;
  }
}
