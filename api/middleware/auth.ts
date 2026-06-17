import type { Request, Response, NextFunction } from 'express';
import db from '../db/database.js';
import type { User } from '../../shared/types.js';

const sessions = new Map<string, User>();

export function createSession(user: User): string {
  const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
  sessions.set(token, user);
  return token;
}

export function removeSession(token: string): void {
  sessions.delete(token);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  
  if (!token) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  const user = sessions.get(token);
  if (!user) {
    res.status(401).json({ success: false, error: '登录已过期' });
    return;
  }

  (req as any).user = user;
  (req as any).token = token;
  next();
}

export function roleMiddleware(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as User;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
    next();
  };
}

export { sessions };
