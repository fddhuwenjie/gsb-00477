/* eslint-disable @typescript-eslint/no-explicit-any */
import express, { type Request, type Response } from 'express';
import db from '../db/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import type { Waitlist, User } from '../../shared/types.js';

const router = express.Router();

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { status, equipment_id, reserve_date, time_slot } = req.query;
  let sql = `SELECT w.*, e.name as equipment_name, u.name as student_name,
             (SELECT COUNT(*) FROM waitlist w2
              WHERE w2.equipment_id = w.equipment_id
              AND w2.reserve_date = w.reserve_date
              AND w2.time_slot = w.time_slot
              AND w2.status = 'waiting'
              AND w2.id < w.id) + 1 as position
             FROM waitlist w
             LEFT JOIN equipment e ON w.equipment_id = e.id
             LEFT JOIN users u ON w.student_id = u.id WHERE 1=1`;
  const params: any[] = [];

  if (user.role === 'student') {
    sql += ' AND w.student_id = ?';
    params.push(user.id);
  }

  if (status) {
    sql += ' AND w.status = ?';
    params.push(status);
  }
  if (equipment_id) {
    sql += ' AND w.equipment_id = ?';
    params.push(equipment_id);
  }
  if (reserve_date) {
    sql += ' AND w.reserve_date = ?';
    params.push(reserve_date);
  }
  if (time_slot) {
    sql += ' AND w.time_slot = ?';
    params.push(time_slot);
  }

  sql += ' ORDER BY w.created_at DESC';
  const entries = db.prepare(sql).all(...params) as Waitlist[];
  res.json({ success: true, data: entries });
});

router.post('/', authMiddleware, roleMiddleware('student'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { equipment_id, reserve_date, time_slot, purpose } = req.body;

  if (!equipment_id || !reserve_date || !time_slot || !purpose) {
    res.status(400).json({ success: false, error: '缺少必填字段' });
    return;
  }

  const equipment: any = db.prepare('SELECT status FROM equipment WHERE id = ?').get(equipment_id);
  if (!equipment) {
    res.status(404).json({ success: false, error: '设备不存在' });
    return;
  }
  if (equipment.status !== 'normal') {
    res.status(400).json({ success: false, error: '该设备当前不可预约' });
    return;
  }

  const taken = db.prepare(`SELECT id FROM reservations
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status IN ('pending', 'approved')`).get(
    equipment_id, reserve_date, time_slot
  );
  if (!taken) {
    res.status(400).json({ success: false, error: '该时段未被预约，无需排队' });
    return;
  }

  const existing = db.prepare(`SELECT id FROM waitlist
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND student_id = ? AND status = 'waiting'`).get(
    equipment_id, reserve_date, time_slot, user.id
  );
  if (existing) {
    res.status(400).json({ success: false, error: '您已在该时段排队中' });
    return;
  }

  const result = db.prepare(`INSERT INTO waitlist
    (equipment_id, student_id, reserve_date, time_slot, purpose, status)
    VALUES (?, ?, ?, ?, ?, 'waiting')`).run(
    equipment_id, user.id, reserve_date, time_slot, purpose
  );

  const entry = db.prepare(`SELECT w.*, e.name as equipment_name, u.name as student_name,
    (SELECT COUNT(*) FROM waitlist w2
     WHERE w2.equipment_id = w.equipment_id
     AND w2.reserve_date = w.reserve_date
     AND w2.time_slot = w.time_slot
     AND w2.status = 'waiting'
     AND w2.id < w.id) + 1 as position
    FROM waitlist w
    LEFT JOIN equipment e ON w.equipment_id = e.id
    LEFT JOIN users u ON w.student_id = u.id
    WHERE w.id = ?`).get(result.lastInsertRowid) as Waitlist;

  res.json({ success: true, data: entry });
});

router.put('/:id/cancel', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const entry = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(req.params.id) as any;

  if (!entry) {
    res.status(404).json({ success: false, error: '排队记录不存在' });
    return;
  }
  if (user.role === 'student' && entry.student_id !== user.id) {
    res.status(403).json({ success: false, error: '无权取消该排队' });
    return;
  }
  if (entry.status === 'cancelled') {
    res.json({ success: true, message: '已经取消' });
    return;
  }
  if (entry.status === 'promoted') {
    res.status(400).json({ success: false, error: '已递补的排队不能取消' });
    return;
  }

  db.prepare("UPDATE waitlist SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ? AND status = 'waiting'").run(req.params.id);
  res.json({ success: true });
});

router.get('/:id/position', authMiddleware, (req: Request, res: Response) => {
  const entry = db.prepare('SELECT * FROM waitlist WHERE id = ?').get(req.params.id) as any;

  if (!entry) {
    res.status(404).json({ success: false, error: '排队记录不存在' });
    return;
  }

  const position = db.prepare(`SELECT COUNT(*) as pos FROM waitlist
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ?
    AND status = 'waiting' AND id < ?`).get(
    entry.equipment_id, entry.reserve_date, entry.time_slot, entry.id
  ) as any;

  res.json({ success: true, data: { position: position.pos + 1 } });
});

export function promoteWaitlist(equipment_id: number, reserve_date: string, time_slot: string): any {
  const slotTaken = db.prepare(`SELECT id FROM reservations
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ?
    AND status IN ('pending', 'approved')`).get(equipment_id, reserve_date, time_slot);
  if (slotTaken) return null;

  const entry: any = db.prepare(`SELECT * FROM waitlist
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status = 'waiting'
    ORDER BY created_at ASC, id ASC LIMIT 1`).get(equipment_id, reserve_date, time_slot);

  if (!entry) return null;

  const existingReservation = db.prepare(`SELECT id FROM reservations WHERE waitlist_id = ?`).get(entry.id);
  if (existingReservation) {
    return db.prepare('SELECT * FROM waitlist WHERE id = ?').get(entry.id);
  }

  const updateResult = db.prepare("UPDATE waitlist SET status = 'promoted', promoted_at = datetime('now') WHERE id = ? AND status = 'waiting'").run(entry.id);
  if (updateResult.changes === 0) {
    return null;
  }

  const equipment: any = db.prepare('SELECT manager_id FROM equipment WHERE id = ?').get(equipment_id);
  const tutor_id = equipment?.manager_id || 1;

  db.prepare(`INSERT INTO reservations
    (equipment_id, student_id, tutor_id, reserve_date, time_slot, purpose, status, approved_at, waitlist_id)
    VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'), ?)`).run(
    entry.equipment_id, entry.student_id, tutor_id, entry.reserve_date, entry.time_slot, entry.purpose, entry.id
  );

  return db.prepare('SELECT * FROM waitlist WHERE id = ?').get(entry.id);
}

export default router;
