import express, { type Request, type Response } from 'express';
import db from '../db/database.js';
import { authMiddleware, createSession, removeSession, sessions } from '../middleware/auth.js';
import type { User } from '../../shared/types.js';

const router = express.Router();

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as any;
  
  if (!user) {
    res.status(401).json({ success: false, error: '用户名或密码错误' });
    return;
  }

  const { password: _, ...userData } = user;
  const token = createSession(userData as User);
  
  res.json({ success: true, data: { user: userData, token } });
});

router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  const token = (req as any).token;
  removeSession(token);
  res.json({ success: true });
});

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  res.json({ success: true, data: user });
});

router.get('/users', authMiddleware, (req: Request, res: Response) => {
  const users = db.prepare('SELECT id, username, name, role, email, phone FROM users ORDER BY role, name').all() as User[];
  res.json({ success: true, data: users });
});

export default router;
