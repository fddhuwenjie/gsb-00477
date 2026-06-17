import express, { type Request, type Response } from 'express';
import db from '../db/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import type { Consumable, ConsumableUsage, ConsumableRestock } from '../../shared/types.js';

const router = express.Router();

router.get('/alerts/list', authMiddleware, (req: Request, res: Response) => {
  const alerts = db.prepare(`SELECT c.*, e.name as equipment_name
    FROM consumables c
    LEFT JOIN equipment e ON c.equipment_id = e.id
    WHERE c.current_stock < c.safety_stock
    ORDER BY c.id`).all() as Consumable[];
  res.json({ success: true, data: alerts });
});

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const { equipment_id } = req.query;
  let sql = `SELECT c.*, e.name as equipment_name
             FROM consumables c
             LEFT JOIN equipment e ON c.equipment_id = e.id WHERE 1=1`;
  const params: any[] = [];

  if (equipment_id) {
    sql += ' AND c.equipment_id = ?';
    params.push(equipment_id);
  }

  sql += ' ORDER BY c.id';
  const consumables = db.prepare(sql).all(...params) as Consumable[];
  res.json({ success: true, data: consumables });
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const consumable = db.prepare(`SELECT c.*, e.name as equipment_name
    FROM consumables c
    LEFT JOIN equipment e ON c.equipment_id = e.id
    WHERE c.id = ?`).get(req.params.id) as Consumable;

  if (!consumable) {
    res.status(404).json({ success: false, error: '耗材不存在' });
    return;
  }

  res.json({ success: true, data: consumable });
});

router.post('/', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { name, equipment_id, current_stock, safety_stock, unit, unit_price, supplier } = req.body;

  if (!name || !equipment_id || current_stock === undefined || safety_stock === undefined || !unit || unit_price === undefined) {
    res.status(400).json({ success: false, error: '缺少必填字段' });
    return;
  }

  const result = db.prepare(`INSERT INTO consumables
    (name, equipment_id, current_stock, safety_stock, unit, unit_price, supplier)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    name, equipment_id, current_stock, safety_stock, unit, unit_price, supplier || null
  );

  const consumable = db.prepare(`SELECT c.*, e.name as equipment_name
    FROM consumables c
    LEFT JOIN equipment e ON c.equipment_id = e.id
    WHERE c.id = ?`).get(result.lastInsertRowid) as Consumable;
  res.json({ success: true, data: consumable });
});

router.put('/:id', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { name, equipment_id, current_stock, safety_stock, unit, unit_price, supplier } = req.body;

  const exists = db.prepare('SELECT id FROM consumables WHERE id = ?').get(req.params.id);
  if (!exists) {
    res.status(404).json({ success: false, error: '耗材不存在' });
    return;
  }

  db.prepare(`UPDATE consumables SET
    name = COALESCE(?, name), equipment_id = COALESCE(?, equipment_id),
    current_stock = COALESCE(?, current_stock), safety_stock = COALESCE(?, safety_stock),
    unit = COALESCE(?, unit), unit_price = COALESCE(?, unit_price),
    supplier = COALESCE(?, supplier)
    WHERE id = ?`).run(
    name, equipment_id, current_stock, safety_stock, unit, unit_price, supplier, req.params.id
  );

  const consumable = db.prepare(`SELECT c.*, e.name as equipment_name
    FROM consumables c
    LEFT JOIN equipment e ON c.equipment_id = e.id
    WHERE c.id = ?`).get(req.params.id) as Consumable;
  res.json({ success: true, data: consumable });
});

router.delete('/:id', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  db.prepare('DELETE FROM consumables WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/usage', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as any;
  const { quantity, usage_log_id } = req.body;

  if (!quantity || quantity <= 0) {
    res.status(400).json({ success: false, error: '使用数量必须大于0' });
    return;
  }

  const consumable = db.prepare('SELECT * FROM consumables WHERE id = ?').get(req.params.id) as any;
  if (!consumable) {
    res.status(404).json({ success: false, error: '耗材不存在' });
    return;
  }

  if (consumable.current_stock < quantity) {
    res.status(400).json({ success: false, error: '库存不足' });
    return;
  }

  db.prepare('UPDATE consumables SET current_stock = current_stock - ? WHERE id = ?').run(quantity, req.params.id);

  const result = db.prepare(`INSERT INTO consumable_usage
    (consumable_id, usage_log_id, quantity, user_id)
    VALUES (?, ?, ?, ?)`).run(req.params.id, usage_log_id || null, quantity, user.id);

  const updated = db.prepare('SELECT * FROM consumables WHERE id = ?').get(req.params.id) as any;
  const usage = db.prepare(`SELECT cu.*, c.name as consumable_name, u.name as user_name
    FROM consumable_usage cu
    LEFT JOIN consumables c ON cu.consumable_id = c.id
    LEFT JOIN users u ON cu.user_id = u.id
    WHERE cu.id = ?`).get(result.lastInsertRowid) as ConsumableUsage;

  const response: any = { success: true, data: usage };
  if (updated.current_stock < updated.safety_stock) {
    response.warning = '库存低于安全线，请及时补货';
  }
  res.json(response);
});

router.get('/:id/usage-history', authMiddleware, (req: Request, res: Response) => {
  const history = db.prepare(`SELECT cu.*, c.name as consumable_name, u.name as user_name
    FROM consumable_usage cu
    LEFT JOIN consumables c ON cu.consumable_id = c.id
    LEFT JOIN users u ON cu.user_id = u.id
    WHERE cu.consumable_id = ?
    ORDER BY cu.used_at DESC`).all(req.params.id) as ConsumableUsage[];
  res.json({ success: true, data: history });
});

router.post('/:id/restock', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const user = (req as any).user as any;
  const { quantity, unit_price } = req.body;

  if (!quantity || quantity <= 0) {
    res.status(400).json({ success: false, error: '补货数量必须大于0' });
    return;
  }

  const consumable = db.prepare('SELECT * FROM consumables WHERE id = ?').get(req.params.id) as any;
  if (!consumable) {
    res.status(404).json({ success: false, error: '耗材不存在' });
    return;
  }

  db.prepare('UPDATE consumables SET current_stock = current_stock + ? WHERE id = ?').run(quantity, req.params.id);

  const result = db.prepare(`INSERT INTO consumable_restock
    (consumable_id, quantity, unit_price, operator_id)
    VALUES (?, ?, ?, ?)`).run(req.params.id, quantity, unit_price || null, user.id);

  const restock = db.prepare(`SELECT cr.*, u.name as operator_name
    FROM consumable_restock cr
    LEFT JOIN users u ON cr.operator_id = u.id
    WHERE cr.id = ?`).get(result.lastInsertRowid) as ConsumableRestock;
  res.json({ success: true, data: restock });
});

router.get('/:id/restock-history', authMiddleware, (req: Request, res: Response) => {
  const history = db.prepare(`SELECT cr.*, u.name as operator_name
    FROM consumable_restock cr
    LEFT JOIN users u ON cr.operator_id = u.id
    WHERE cr.consumable_id = ?
    ORDER BY cr.restocked_at DESC`).all(req.params.id) as ConsumableRestock[];
  res.json({ success: true, data: history });
});

export default router;
