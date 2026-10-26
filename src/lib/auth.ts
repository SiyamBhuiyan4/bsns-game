import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { getJwtKey } from './env';

const BCRYPT_ROUNDS = 12;
const secretKey = getJwtKey();

export interface SessionUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  phone?: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: {
  userId: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
  phone?: string | null;
  id?: string;
}): Promise<string> {
  const finalId = payload.id || payload.userId;
  return new SignJWT({ ...payload, id: finalId, userId: payload.userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    const userId = (payload.userId || payload.id) as string;
    return {
      id: userId,
      userId: userId,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as 'ADMIN' | 'EMPLOYEE',
      phone: (payload.phone as string) || null,
    };
  } catch {
    return null;
  }
}
