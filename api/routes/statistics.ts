import express, { type Request, type Response } from 'express';
import db from '../db/database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/overview', authMiddleware, (req: Request, res: Response) => {
  const totalEquipment = (db.prepare('SELECT COUNT(*) as count FROM equipment').get() as any).count;
  const normalEquipment = (db.prepare("SELECT COUNT(*) as count FROM equipment WHERE status = 'normal'").get() as any).count;
  const pendingReservations = (db.prepare("SELECT COUNT(*) as count FROM reservations WHERE status = 'pending'").get() as any).count;
  const openFaults = (db.prepare("SELECT COUNT(*) as count FROM fault_reports WHERE status != 'resolved'").get() as any).count;
  const totalReservations = (db.prepare('SELECT COUNT(*) as count FROM reservations').get() as any).count;
  const totalUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get() as any).count;

  res.json({
    success: true,
    data: {
      totalEquipment,
      normalEquipment,
      pendingReservations,
      openFaults,
      totalReservations,
      totalUsers
    }
  });
});

router.get('/usage-rate', authMiddleware, (req: Request, res: Response) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalSlots = daysInMonth * 3;

  const usageRates = db.prepare(`SELECT 
      e.id, e.name, e.category,
      COUNT(r.id) as used_slots,
      ? as total_slots,
      ROUND(CAST(COUNT(r.id) AS FLOAT) / ? * 100, 2) as usage_rate
    FROM equipment e
    LEFT JOIN reservations r ON e.id = r.equipment_id 
      AND r.status != 'rejected' AND r.status != 'cancelled'
      AND strftime('%Y-%m', r.reserve_date) = ?
    GROUP BY e.id, e.name, e.category
    ORDER BY usage_rate DESC`).all(totalSlots, totalSlots, `${year}-${String(month).padStart(2, '0')}`);

  res.json({ success: true, data: usageRates });
});

router.get('/popular-equip', authMiddleware, (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 10;
  const popular = db.prepare(`SELECT 
      e.id, e.name, e.category, COUNT(r.id) as reservation_count
    FROM equipment e
    LEFT JOIN reservations r ON e.id = r.equipment_id AND r.status != 'rejected' AND r.status != 'cancelled'
    GROUP BY e.id, e.name, e.category
    ORDER BY reservation_count DESC
    LIMIT ?`).all(limit);

  res.json({ success: true, data: popular });
});

router.get('/lab-frequency', authMiddleware, (req: Request, res: Response) => {
  const frequencies = db.prepare(`SELECT 
      l.id, l.name, l.location, COUNT(r.id) as usage_count
    FROM labs l
    LEFT JOIN equipment e ON l.id = e.lab_id
    LEFT JOIN reservations r ON e.id = r.equipment_id AND r.status != 'rejected' AND r.status != 'cancelled'
    GROUP BY l.id, l.name, l.location
    ORDER BY usage_count DESC`).all();

  res.json({ success: true, data: frequencies });
});

router.get('/user-ranking', authMiddleware, (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 10;
  const ranking = db.prepare(`SELECT 
      u.id, u.name, u.role,
      COUNT(r.id) as reservation_count,
      COUNT(ul.id) as usage_count
    FROM users u
    LEFT JOIN reservations r ON u.id = r.student_id AND r.status != 'rejected' AND r.status != 'cancelled'
    LEFT JOIN usage_logs ul ON u.id = ul.user_id
    WHERE u.role = 'student'
    GROUP BY u.id, u.name
    ORDER BY usage_count DESC, reservation_count DESC
    LIMIT ?`).all(limit);

  res.json({ success: true, data: ranking });
});

router.get('/fault-stats', authMiddleware, (req: Request, res: Response) => {
  const byUrgency = db.prepare(`SELECT urgency, COUNT(*) as count 
    FROM fault_reports GROUP BY urgency`).all();
  
  const byStatus = db.prepare(`SELECT status, COUNT(*) as count 
    FROM fault_reports GROUP BY status`).all();
  
  const byEquipment = db.prepare(`SELECT 
      e.id, e.name, COUNT(fr.id) as fault_count
    FROM equipment e
    LEFT JOIN fault_reports fr ON e.id = fr.equipment_id
    GROUP BY e.id, e.name
    HAVING fault_count > 0
    ORDER BY fault_count DESC
    LIMIT 10`).all();

  res.json({ success: true, data: { byUrgency, byStatus, byEquipment } });
});

export default router;
