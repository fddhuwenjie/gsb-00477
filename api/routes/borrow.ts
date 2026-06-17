import express, { type Request, type Response } from 'express';
import db from '../db/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import type { EquipmentBorrow, User } from '../../shared/types.js';

const router = express.Router();

export function checkEquipmentBorrowed(equipment_id: number, date: string): boolean {
  const existing = db.prepare(`SELECT id FROM equipment_borrows
    WHERE equipment_id = ? AND status = 'approved'
    AND borrow_date <= ? AND return_date >= ?`).get(equipment_id, date, date);
  return !!existing;
}

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { status } = req.query;
  let sql = `SELECT b.*, e.name as equipment_name, u.name as borrower_name,
             fl.name as from_lab_name, tl.name as to_lab_name
             FROM equipment_borrows b
             LEFT JOIN equipment e ON b.equipment_id = e.id
             LEFT JOIN users u ON b.borrower_id = u.id
             LEFT JOIN labs fl ON b.from_lab_id = fl.id
             LEFT JOIN labs tl ON b.to_lab_id = tl.id WHERE 1=1`;
  const params: any[] = [];

  if (user.role === 'student') {
    sql += ' AND b.borrower_id = ?';
    params.push(user.id);
  } else if (user.role === 'tutor') {
    sql += ' AND (b.from_lab_id IN (SELECT lab_id FROM equipment WHERE manager_id = ?) OR b.to_lab_id IN (SELECT lab_id FROM equipment WHERE manager_id = ?))';
    params.push(user.id, user.id);
  }

  if (status) {
    sql += ' AND b.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY b.created_at DESC';
  const borrows = db.prepare(sql).all(...params) as EquipmentBorrow[];
  res.json({ success: true, data: borrows });
});

router.post('/', authMiddleware, roleMiddleware('student'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { equipment_id, from_lab_id, to_lab_id, borrow_date, return_date } = req.body;

  if (!equipment_id || !from_lab_id || !to_lab_id || !borrow_date || !return_date) {
    res.status(400).json({ success: false, error: '缺少必填字段' });
    return;
  }

  const equipment: any = db.prepare('SELECT id, status FROM equipment WHERE id = ?').get(equipment_id);
  if (!equipment) {
    res.status(404).json({ success: false, error: '设备不存在' });
    return;
  }

  const conflict = db.prepare(`SELECT id FROM equipment_borrows
    WHERE equipment_id = ? AND status IN ('pending', 'approved')
    AND borrow_date <= ? AND return_date >= ?`).get(equipment_id, return_date, borrow_date);
  if (conflict) {
    res.status(400).json({ success: false, error: '该设备在所选日期范围内已被借出' });
    return;
  }

  const result = db.prepare(`INSERT INTO equipment_borrows
    (equipment_id, borrower_id, from_lab_id, to_lab_id, borrow_date, return_date, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')`).run(
    equipment_id, user.id, from_lab_id, to_lab_id, borrow_date, return_date
  );

  const borrow = db.prepare(`SELECT b.*, e.name as equipment_name, u.name as borrower_name,
    fl.name as from_lab_name, tl.name as to_lab_name
    FROM equipment_borrows b
    LEFT JOIN equipment e ON b.equipment_id = e.id
    LEFT JOIN users u ON b.borrower_id = u.id
    LEFT JOIN labs fl ON b.from_lab_id = fl.id
    LEFT JOIN labs tl ON b.to_lab_id = tl.id
    WHERE b.id = ?`).get(result.lastInsertRowid) as EquipmentBorrow;

  res.json({ success: true, data: borrow });
});

router.put('/:id/approve', authMiddleware, roleMiddleware('tutor', 'admin'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const borrow = db.prepare('SELECT * FROM equipment_borrows WHERE id = ?').get(req.params.id) as any;

  if (!borrow) {
    res.status(404).json({ success: false, error: '借用记录不存在' });
    return;
  }

  if (user.role === 'tutor') {
    const equipment: any = db.prepare('SELECT manager_id FROM equipment WHERE id = ?').get(borrow.equipment_id);
    if (!equipment || equipment.manager_id !== user.id) {
      res.status(403).json({ success: false, error: '无权审批该借用申请' });
      return;
    }
  }

  if (borrow.status !== 'pending') {
    res.status(400).json({ success: false, error: '该借用申请已处理' });
    return;
  }

  db.prepare("UPDATE equipment_borrows SET status = 'approved', approved_at = datetime('now') WHERE id = ?").run(req.params.id);
  const updated = db.prepare(`SELECT b.*, e.name as equipment_name, u.name as borrower_name,
    fl.name as from_lab_name, tl.name as to_lab_name
    FROM equipment_borrows b
    LEFT JOIN equipment e ON b.equipment_id = e.id
    LEFT JOIN users u ON b.borrower_id = u.id
    LEFT JOIN labs fl ON b.from_lab_id = fl.id
    LEFT JOIN labs tl ON b.to_lab_id = tl.id
    WHERE b.id = ?`).get(req.params.id) as EquipmentBorrow;

  res.json({ success: true, data: updated });
});

router.put('/:id/reject', authMiddleware, roleMiddleware('tutor', 'admin'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const borrow = db.prepare('SELECT * FROM equipment_borrows WHERE id = ?').get(req.params.id) as any;

  if (!borrow) {
    res.status(404).json({ success: false, error: '借用记录不存在' });
    return;
  }

  if (user.role === 'tutor') {
    const equipment: any = db.prepare('SELECT manager_id FROM equipment WHERE id = ?').get(borrow.equipment_id);
    if (!equipment || equipment.manager_id !== user.id) {
      res.status(403).json({ success: false, error: '无权审批该借用申请' });
      return;
    }
  }

  db.prepare("UPDATE equipment_borrows SET status = 'rejected' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.put('/:id/return', authMiddleware, roleMiddleware('tutor', 'admin'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const borrow = db.prepare('SELECT * FROM equipment_borrows WHERE id = ?').get(req.params.id) as any;

  if (!borrow) {
    res.status(404).json({ success: false, error: '借用记录不存在' });
    return;
  }

  if (user.role === 'tutor') {
    const equipment: any = db.prepare('SELECT manager_id FROM equipment WHERE id = ?').get(borrow.equipment_id);
    if (!equipment || equipment.manager_id !== user.id) {
      res.status(403).json({ success: false, error: '无权操作该借用记录' });
      return;
    }
  }

  if (borrow.status !== 'approved') {
    res.status(400).json({ success: false, error: '该借用申请未被批准，无法归还' });
    return;
  }

  db.prepare("UPDATE equipment_borrows SET status = 'returned' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

export default router;
