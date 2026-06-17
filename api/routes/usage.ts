import express, { type Request, type Response } from 'express';
import db from '../db/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import type { UsageLog, FaultReport, User } from '../../shared/types.js';

const router = express.Router();

router.post('/checkin', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { equipment_id, reservation_id } = req.body;
  
  if (!equipment_id) {
    res.status(400).json({ success: false, error: '缺少设备编号' });
    return;
  }

  const equipment: any = db.prepare('SELECT id, name, status FROM equipment WHERE id = ?').get(equipment_id);
  if (!equipment) {
    res.status(404).json({ success: false, error: '设备不存在' });
    return;
  }
  if (equipment.status !== 'normal') {
    res.status(400).json({ success: false, error: '设备状态异常，无法使用' });
    return;
  }

  if (reservation_id) {
    const reservation: any = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservation_id);
    if (!reservation || reservation.student_id !== user.id || reservation.status !== 'approved') {
      res.status(400).json({ success: false, error: '预约无效或不属于您' });
      return;
    }
  }

  const result = db.prepare(`INSERT INTO usage_logs 
    (reservation_id, equipment_id, user_id, checkin_time, has_anomaly) 
    VALUES (?, ?, ?, datetime('now'), 0)`).run(
    reservation_id || null, equipment_id, user.id
  );

  const log = db.prepare(`SELECT ul.*, e.name as equipment_name, u.name as user_name 
    FROM usage_logs ul 
    LEFT JOIN equipment e ON ul.equipment_id = e.id 
    LEFT JOIN users u ON ul.user_id = u.id 
    WHERE ul.id = ?`).get(result.lastInsertRowid) as UsageLog;

  res.json({ success: true, data: log });
});

router.post('/checkout', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { log_id, experiment_content, equipment_status, has_anomaly, sample_count } = req.body;
  
  if (!log_id) {
    res.status(400).json({ success: false, error: '缺少使用日志ID' });
    return;
  }

  const log: any = db.prepare('SELECT * FROM usage_logs WHERE id = ?').get(log_id);
  if (!log) {
    res.status(404).json({ success: false, error: '使用记录不存在' });
    return;
  }
  if (log.user_id !== user.id && user.role === 'student') {
    res.status(403).json({ success: false, error: '无权操作' });
    return;
  }
  if (log.checkout_time) {
    res.status(400).json({ success: false, error: '该使用记录已结束' });
    return;
  }

  db.prepare(`UPDATE usage_logs SET 
    checkout_time = datetime('now'), experiment_content = ?, equipment_status = ?, 
    has_anomaly = ?, sample_count = ? WHERE id = ?`).run(
    experiment_content, equipment_status, has_anomaly ? 1 : 0, sample_count || 0, log_id
  );

  if (log.reservation_id) {
    db.prepare("UPDATE reservations SET status = 'completed' WHERE id = ?").run(log.reservation_id);
  }

  const updated = db.prepare(`SELECT ul.*, e.name as equipment_name, u.name as user_name 
    FROM usage_logs ul 
    LEFT JOIN equipment e ON ul.equipment_id = e.id 
    LEFT JOIN users u ON ul.user_id = u.id 
    WHERE ul.id = ?`).get(log_id) as UsageLog;

  res.json({ success: true, data: updated });
});

router.get('/logs', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  let sql = `SELECT ul.*, e.name as equipment_name, u.name as user_name 
             FROM usage_logs ul 
             LEFT JOIN equipment e ON ul.equipment_id = e.id 
             LEFT JOIN users u ON ul.user_id = u.id WHERE 1=1`;
  const params: any[] = [];

  if (user.role === 'student') {
    sql += ' AND ul.user_id = ?';
    params.push(user.id);
  }
  
  sql += ' ORDER BY ul.checkin_time DESC';
  const logs = db.prepare(sql).all(...params) as UsageLog[];
  res.json({ success: true, data: logs });
});

router.post('/fault', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { equipment_id, description, urgency } = req.body;
  
  if (!equipment_id || !description || !urgency) {
    res.status(400).json({ success: false, error: '缺少必填字段' });
    return;
  }

  const result = db.prepare(`INSERT INTO fault_reports 
    (equipment_id, reporter_id, description, urgency, status) 
    VALUES (?, ?, ?, ?, 'reported')`).run(
    equipment_id, user.id, description, urgency
  );

  const report = db.prepare(`SELECT fr.*, e.name as equipment_name, u.name as reporter_name 
    FROM fault_reports fr 
    LEFT JOIN equipment e ON fr.equipment_id = e.id 
    LEFT JOIN users u ON fr.reporter_id = u.id 
    WHERE fr.id = ?`).get(result.lastInsertRowid) as FaultReport;

  res.json({ success: true, data: report });
});

router.get('/faults', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  let sql = `SELECT fr.*, e.name as equipment_name, u.name as reporter_name 
             FROM fault_reports fr 
             LEFT JOIN equipment e ON fr.equipment_id = e.id 
             LEFT JOIN users u ON fr.reporter_id = u.id WHERE 1=1`;
  const params: any[] = [];

  if (user.role === 'student') {
    sql += ' AND fr.reporter_id = ?';
    params.push(user.id);
  }
  
  sql += ' ORDER BY fr.created_at DESC';
  const reports = db.prepare(sql).all(...params) as FaultReport[];
  res.json({ success: true, data: reports });
});

router.put('/faults/:id', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { status, resolution } = req.body;
  
  const report = db.prepare('SELECT * FROM fault_reports WHERE id = ?').get(req.params.id);
  if (!report) {
    res.status(404).json({ success: false, error: '故障报告不存在' });
    return;
  }

  db.prepare(`UPDATE fault_reports SET 
    status = COALESCE(?, status), resolution = COALESCE(?, resolution),
    resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') ELSE resolved_at END
    WHERE id = ?`).run(status, resolution, status, req.params.id);

  const updated = db.prepare(`SELECT fr.*, e.name as equipment_name, u.name as reporter_name 
    FROM fault_reports fr 
    LEFT JOIN equipment e ON fr.equipment_id = e.id 
    LEFT JOIN users u ON fr.reporter_id = u.id 
    WHERE fr.id = ?`).get(req.params.id) as FaultReport;

  res.json({ success: true, data: updated });
});

export default router;
