import express, { type Request, type Response } from 'express';
import db from '../db/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import type { MaintenancePlan, MaintenanceRecord } from '../../shared/types.js';

const router = express.Router();

router.get('/plans', authMiddleware, (req: Request, res: Response) => {
  const { equipment_id, is_active } = req.query;
  let sql = `SELECT mp.*, e.name as equipment_name 
             FROM maintenance_plans mp 
             LEFT JOIN equipment e ON mp.equipment_id = e.id WHERE 1=1`;
  const params: any[] = [];
  
  if (equipment_id) {
    sql += ' AND mp.equipment_id = ?';
    params.push(equipment_id);
  }
  if (is_active !== undefined) {
    sql += ' AND mp.is_active = ?';
    params.push(is_active === 'true' ? 1 : 0);
  }
  
  sql += ' ORDER BY mp.next_due_date ASC';
  const plans = db.prepare(sql).all(...params) as MaintenancePlan[];
  res.json({ success: true, data: plans });
});

router.post('/plans', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { equipment_id, frequency, content, next_due_date } = req.body;
  
  if (!equipment_id || !frequency || !content || !next_due_date) {
    res.status(400).json({ success: false, error: '缺少必填字段' });
    return;
  }

  const result = db.prepare(`INSERT INTO maintenance_plans 
    (equipment_id, frequency, content, next_due_date, is_active) 
    VALUES (?, ?, ?, ?, 1)`).run(equipment_id, frequency, content, next_due_date);

  const plan = db.prepare('SELECT * FROM maintenance_plans WHERE id = ?').get(result.lastInsertRowid) as MaintenancePlan;
  res.json({ success: true, data: plan });
});

router.put('/plans/:id', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { frequency, content, next_due_date, is_active } = req.body;
  
  db.prepare(`UPDATE maintenance_plans SET 
    frequency = COALESCE(?, frequency), content = COALESCE(?, content),
    next_due_date = COALESCE(?, next_due_date), is_active = COALESCE(?, is_active)
    WHERE id = ?`).run(frequency, content, next_due_date, is_active, req.params.id);

  const plan = db.prepare('SELECT * FROM maintenance_plans WHERE id = ?').get(req.params.id) as MaintenancePlan;
  res.json({ success: true, data: plan });
});

router.get('/records', authMiddleware, (req: Request, res: Response) => {
  const { equipment_id } = req.query;
  let sql = `SELECT mr.*, e.name as equipment_name, u.name as maintainer_name 
             FROM maintenance_records mr 
             LEFT JOIN equipment e ON mr.equipment_id = e.id 
             LEFT JOIN users u ON mr.maintainer_id = u.id WHERE 1=1`;
  const params: any[] = [];
  
  if (equipment_id) {
    sql += ' AND mr.equipment_id = ?';
    params.push(equipment_id);
  }
  
  sql += ' ORDER BY mr.maintenance_date DESC';
  const records = db.prepare(sql).all(...params) as MaintenanceRecord[];
  res.json({ success: true, data: records });
});

router.post('/records', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const user = (req as any).user as any;
  const { equipment_id, plan_id, maintenance_date, content, replaced_parts, cost } = req.body;
  
  if (!equipment_id || !maintenance_date || !content) {
    res.status(400).json({ success: false, error: '缺少必填字段' });
    return;
  }

  const result = db.prepare(`INSERT INTO maintenance_records 
    (equipment_id, plan_id, maintainer_id, maintenance_date, content, replaced_parts, cost) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    equipment_id, plan_id || null, user.id, maintenance_date, content, replaced_parts || null, cost || 0
  );

  const record = db.prepare(`SELECT mr.*, e.name as equipment_name, u.name as maintainer_name 
    FROM maintenance_records mr 
    LEFT JOIN equipment e ON mr.equipment_id = e.id 
    LEFT JOIN users u ON mr.maintainer_id = u.id 
    WHERE mr.id = ?`).get(result.lastInsertRowid) as MaintenanceRecord;
  res.json({ success: true, data: record });
});

router.get('/lifecycle/:equipmentId', authMiddleware, (req: Request, res: Response) => {
  const { equipmentId } = req.params;
  
  const equipment: any = db.prepare(`SELECT e.*, l.name as lab_name, u.name as manager_name 
    FROM equipment e 
    LEFT JOIN labs l ON e.lab_id = l.id 
    LEFT JOIN users u ON e.manager_id = u.id 
    WHERE e.id = ?`).get(equipmentId);
  
  if (!equipment) {
    res.status(404).json({ success: false, error: '设备不存在' });
    return;
  }

  const totalUsageMinutes = (db.prepare(`SELECT 
    COALESCE(SUM(CAST((julianday(checkout_time) - julianday(checkin_time)) * 24 * 60 AS INTEGER)), 0) as total_minutes
    FROM usage_logs WHERE equipment_id = ? AND checkout_time IS NOT NULL`).get(equipmentId) as any).total_minutes;

  const totalMaintenanceCost = (db.prepare(`SELECT COALESCE(SUM(cost), 0) as total_cost 
    FROM maintenance_records WHERE equipment_id = ?`).get(equipmentId) as any).total_cost;

  const maintenanceRecordCount = (db.prepare('SELECT COUNT(*) as count FROM maintenance_records WHERE equipment_id = ?').get(equipmentId) as any).count;
  const usageCount = (db.prepare('SELECT COUNT(*) as count FROM usage_logs WHERE equipment_id = ?').get(equipmentId) as any).count;
  const faultCount = (db.prepare('SELECT COUNT(*) as count FROM fault_reports WHERE equipment_id = ?').get(equipmentId) as any).count;

  const hours = Math.floor(totalUsageMinutes / 60);
  const minutes = totalUsageMinutes % 60;

  res.json({
    success: true,
    data: {
      equipment,
      totalUsageTime: { hours, minutes, totalMinutes: totalUsageMinutes },
      totalMaintenanceCost,
      maintenanceRecordCount,
      usageCount,
      faultCount
    }
  });
});

router.get('/due-soon', authMiddleware, (req: Request, res: Response) => {
  const days = Number(req.query.days) || 30;
  const due = db.prepare(`SELECT mp.*, e.name as equipment_name 
    FROM maintenance_plans mp 
    LEFT JOIN equipment e ON mp.equipment_id = e.id 
    WHERE mp.is_active = 1 AND julianday(mp.next_due_date) - julianday('now') <= ?
    ORDER BY mp.next_due_date ASC`).all(days);

  res.json({ success: true, data: due });
});

export default router;
