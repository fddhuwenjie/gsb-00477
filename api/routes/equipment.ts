import express, { type Request, type Response } from 'express';
import db from '../db/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import type { Equipment, EquipmentCategory, EquipmentStatus } from '../../shared/types.js';

const router = express.Router();

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const { category, status, lab_id } = req.query;
  let sql = `SELECT e.*, l.name as lab_name, u.name as manager_name 
             FROM equipment e 
             LEFT JOIN labs l ON e.lab_id = l.id 
             LEFT JOIN users u ON e.manager_id = u.id WHERE 1=1`;
  const params: any[] = [];
  
  if (category) {
    sql += ' AND e.category = ?';
    params.push(category);
  }
  if (status) {
    sql += ' AND e.status = ?';
    params.push(status);
  }
  if (lab_id) {
    sql += ' AND e.lab_id = ?';
    params.push(lab_id);
  }
  
  sql += ' ORDER BY e.id';
  const equipment = db.prepare(sql).all(...params) as Equipment[];
  res.json({ success: true, data: equipment });
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const equipment = db.prepare(`SELECT e.*, l.name as lab_name, l.location as lab_location, u.name as manager_name 
                                FROM equipment e 
                                LEFT JOIN labs l ON e.lab_id = l.id 
                                LEFT JOIN users u ON e.manager_id = u.id 
                                WHERE e.id = ?`).get(req.params.id) as Equipment;
  
  if (!equipment) {
    res.status(404).json({ success: false, error: '设备不存在' });
    return;
  }
  
  res.json({ success: true, data: equipment });
});

router.post('/', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { name, model, lab_id, manager_id, status, purchase_no, unit_price, purchase_date, category, photo_url, precautions } = req.body;
  
  if (!name || !model || !lab_id || !category) {
    res.status(400).json({ success: false, error: '缺少必填字段' });
    return;
  }

  const result = db.prepare(`INSERT INTO equipment 
    (name, model, lab_id, manager_id, status, purchase_no, unit_price, purchase_date, category, photo_url, precautions) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    name, model, lab_id, manager_id, status || 'normal', purchase_no, unit_price, purchase_date, category, photo_url, precautions
  );

  const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(result.lastInsertRowid) as Equipment;
  res.json({ success: true, data: equipment });
});

router.put('/:id', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { name, model, lab_id, manager_id, status, purchase_no, unit_price, purchase_date, category, photo_url, precautions } = req.body;
  
  const exists = db.prepare('SELECT id FROM equipment WHERE id = ?').get(req.params.id);
  if (!exists) {
    res.status(404).json({ success: false, error: '设备不存在' });
    return;
  }

  db.prepare(`UPDATE equipment SET 
    name = COALESCE(?, name), model = COALESCE(?, model), lab_id = COALESCE(?, lab_id), 
    manager_id = COALESCE(?, manager_id), status = COALESCE(?, status), 
    purchase_no = COALESCE(?, purchase_no), unit_price = COALESCE(?, unit_price), 
    purchase_date = COALESCE(?, purchase_date), category = COALESCE(?, category), 
    photo_url = COALESCE(?, photo_url), precautions = COALESCE(?, precautions) 
    WHERE id = ?`).run(
    name, model, lab_id, manager_id, status, purchase_no, unit_price, purchase_date, category, photo_url, precautions, req.params.id
  );

  const equipment = db.prepare('SELECT * FROM equipment WHERE id = ?').get(req.params.id) as Equipment;
  res.json({ success: true, data: equipment });
});

router.delete('/:id', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM equipment WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/labs/list', authMiddleware, (req: Request, res: Response) => {
  const labs = db.prepare('SELECT * FROM labs').all();
  res.json({ success: true, data: labs });
});

export default router;
