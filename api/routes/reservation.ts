import express, { type Request, type Response } from 'express';
import db from '../db/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import type { Reservation, User } from '../../shared/types.js';
import { promoteWaitlist } from './waitlist.js';
import { checkEquipmentBorrowed } from './borrow.js';

const router = express.Router();

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { equipment_id, status, student_id, tutor_id, project_id } = req.query;
  let sql = `SELECT r.*, e.name as equipment_name, s.name as student_name, t.name as tutor_name, p.name as project_name
             FROM reservations r 
             LEFT JOIN equipment e ON r.equipment_id = e.id 
             LEFT JOIN users s ON r.student_id = s.id 
             LEFT JOIN users t ON r.tutor_id = t.id
             LEFT JOIN projects p ON r.project_id = p.id WHERE 1=1`;
  const params: any[] = [];

  if (user.role === 'student') {
    sql += ' AND r.student_id = ?';
    params.push(user.id);
  } else if (user.role === 'tutor') {
    sql += ' AND r.tutor_id = ?';
    params.push(user.id);
  }
  
  if (equipment_id) {
    sql += ' AND r.equipment_id = ?';
    params.push(equipment_id);
  }
  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }
  if (student_id) {
    sql += ' AND r.student_id = ?';
    params.push(student_id);
  }
  if (tutor_id) {
    sql += ' AND r.tutor_id = ?';
    params.push(tutor_id);
  }
  if (project_id) {
    sql += ' AND r.project_id = ?';
    params.push(project_id);
  }
  
  sql += ' ORDER BY r.created_at DESC';
  const reservations = db.prepare(sql).all(...params) as Reservation[];
  res.json({ success: true, data: reservations });
});

router.get('/check', authMiddleware, (req: Request, res: Response) => {
  const { equipment_id, reserve_date, time_slot } = req.query;
  
  if (!equipment_id || !reserve_date || !time_slot) {
    res.status(400).json({ success: false, error: '缺少参数' });
    return;
  }

  const existing = db.prepare(`SELECT id FROM reservations 
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status != 'rejected' AND status != 'cancelled'`).get(
    equipment_id, reserve_date, time_slot
  );

  res.json({ success: true, data: { available: !existing } });
});

router.post('/', authMiddleware, roleMiddleware('student'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { equipment_id, tutor_id, project_id, reserve_date, time_slot, purpose } = req.body;
  
  if (!equipment_id || !tutor_id || !reserve_date || !time_slot || !purpose) {
    res.status(400).json({ success: false, error: '缺少必填字段' });
    return;
  }

  const equipment: any = db.prepare('SELECT category, status, lab_id FROM equipment WHERE id = ?').get(equipment_id);
  if (!equipment) {
    res.status(404).json({ success: false, error: '设备不存在' });
    return;
  }
  if (equipment.status !== 'normal') {
    res.status(400).json({ success: false, error: '该设备当前不可预约' });
    return;
  }

  if (checkEquipmentBorrowed(equipment_id, reserve_date)) {
    res.status(400).json({ success: false, error: '该设备该日期已被借出，无法预约' });
    return;
  }

  if (project_id) {
    const projectMember = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND student_id = ?').get(project_id, user.id);
    if (!projectMember) {
      res.status(400).json({ success: false, error: '您不是该项目成员，无法关联预约' });
      return;
    }
    const projectEquipment = db.prepare('SELECT id FROM project_equipment WHERE project_id = ? AND equipment_id = ?').get(project_id, equipment_id);
    if (!projectEquipment) {
      res.status(400).json({ success: false, error: '该设备未关联到该项目' });
      return;
    }
  }

  const qualified = db.prepare(`SELECT id FROM training_qualifications 
    WHERE user_id = ? AND category = ? AND is_valid = 1 AND expiry_date >= date('now')`).get(user.id, equipment.category);
  if (!qualified) {
    res.status(400).json({ success: false, error: '您尚未通过该类设备的安全培训，无法预约' });
    return;
  }

  const conflict = db.prepare(`SELECT id FROM reservations 
    WHERE equipment_id = ? AND reserve_date = ? AND time_slot = ? AND status IN ('pending', 'approved')`).get(
    equipment_id, reserve_date, time_slot
  );
  if (conflict) {
    res.status(400).json({ success: false, error: '该时段已被预约' });
    return;
  }

  const result = db.prepare(`INSERT INTO reservations 
    (equipment_id, student_id, tutor_id, project_id, reserve_date, time_slot, purpose, status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`).run(
    equipment_id, user.id, tutor_id, project_id || null, reserve_date, time_slot, purpose
  );

  const reservation = db.prepare(`SELECT r.*, e.name as equipment_name, s.name as student_name, t.name as tutor_name, p.name as project_name
    FROM reservations r 
    LEFT JOIN equipment e ON r.equipment_id = e.id 
    LEFT JOIN users s ON r.student_id = s.id 
    LEFT JOIN users t ON r.tutor_id = t.id
    LEFT JOIN projects p ON r.project_id = p.id
    WHERE r.id = ?`).get(result.lastInsertRowid) as Reservation;

  res.json({ success: true, data: reservation });
});

router.put('/:id/approve', authMiddleware, roleMiddleware('tutor', 'admin'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as any;
  
  if (!reservation) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }
  if (user.role === 'tutor' && reservation.tutor_id !== user.id) {
    res.status(403).json({ success: false, error: '无权审批该预约' });
    return;
  }
  if (reservation.status !== 'pending') {
    res.status(400).json({ success: false, error: '该预约已处理' });
    return;
  }

  db.prepare("UPDATE reservations SET status = 'approved', approved_at = datetime('now') WHERE id = ?").run(req.params.id);
  const updated = db.prepare(`SELECT r.*, e.name as equipment_name, s.name as student_name, t.name as tutor_name, p.name as project_name
    FROM reservations r 
    LEFT JOIN equipment e ON r.equipment_id = e.id 
    LEFT JOIN users s ON r.student_id = s.id 
    LEFT JOIN users t ON r.tutor_id = t.id
    LEFT JOIN projects p ON r.project_id = p.id
    WHERE r.id = ?`).get(req.params.id) as Reservation;
  
  res.json({ success: true, data: updated });
});

router.put('/:id/reject', authMiddleware, roleMiddleware('tutor', 'admin'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as any;
  
  if (!reservation) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }
  if (user.role === 'tutor' && reservation.tutor_id !== user.id) {
    res.status(403).json({ success: false, error: '无权审批该预约' });
    return;
  }

  db.prepare("UPDATE reservations SET status = 'rejected' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.post('/auto-cancel-timeout', authMiddleware, (req: Request, res: Response) => {
  const cancelled: number[] = [];
  const timeoutReservations = db.prepare(`SELECT r.id, r.equipment_id, r.reserve_date, r.time_slot 
    FROM reservations r 
    WHERE r.status = 'approved' 
    AND r.reserve_date = date('now')
    AND CASE r.time_slot 
      WHEN 'morning' THEN time('now') > time('08:15')
      WHEN 'afternoon' THEN time('now') > time('14:15')
      WHEN 'evening' THEN time('now') > time('19:15')
    END
    AND NOT EXISTS (SELECT 1 FROM usage_logs ul WHERE ul.reservation_id = r.id)`).all() as any[];
  
  for (const r of timeoutReservations) {
    db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(r.id);
    promoteWaitlist(r.equipment_id, r.reserve_date, r.time_slot);
    cancelled.push(r.id);
  }
  
  res.json({ success: true, data: { cancelled } });
});

router.put('/:id/cancel', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as any;
  
  if (!reservation) {
    res.status(404).json({ success: false, error: '预约不存在' });
    return;
  }
  if (user.role === 'student' && reservation.student_id !== user.id) {
    res.status(403).json({ success: false, error: '无权取消该预约' });
    return;
  }

  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  
  const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id) as any;
  if (updated) {
    promoteWaitlist(updated.equipment_id, updated.reserve_date, updated.time_slot);
  }
  
  res.json({ success: true });
});

export default router;
