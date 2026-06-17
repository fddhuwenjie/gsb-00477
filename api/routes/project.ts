import express, { type Request, type Response } from 'express';
import db from '../db/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import type { Project, ProjectMember, ProjectEquipment, User } from '../../shared/types.js';

const router = express.Router();

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  let sql = `SELECT p.*, u.name as tutor_name
             FROM projects p
             LEFT JOIN users u ON p.tutor_id = u.id WHERE 1=1`;
  const params: any[] = [];

  if (user.role === 'student') {
    sql += ' AND p.id IN (SELECT project_id FROM project_members WHERE student_id = ?)';
    params.push(user.id);
  }

  sql += ' ORDER BY p.id';
  const projects = db.prepare(sql).all(...params) as any[];

  for (const project of projects) {
    project.members = db.prepare(`SELECT pm.*, u.name as student_name
                                  FROM project_members pm
                                  LEFT JOIN users u ON pm.student_id = u.id
                                  WHERE pm.project_id = ?`).all(project.id) as ProjectMember[];
    project.equipment_list = db.prepare(`SELECT pe.*, e.name as equipment_name
                                         FROM project_equipment pe
                                         LEFT JOIN equipment e ON pe.equipment_id = e.id
                                         WHERE pe.project_id = ?`).all(project.id) as ProjectEquipment[];
  }

  res.json({ success: true, data: projects });
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const project = db.prepare(`SELECT p.*, u.name as tutor_name
                              FROM projects p
                              LEFT JOIN users u ON p.tutor_id = u.id
                              WHERE p.id = ?`).get(req.params.id) as any;

  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  project.members = db.prepare(`SELECT pm.*, u.name as student_name
                                FROM project_members pm
                                LEFT JOIN users u ON pm.student_id = u.id
                                WHERE pm.project_id = ?`).all(project.id) as ProjectMember[];
  project.equipment_list = db.prepare(`SELECT pe.*, e.name as equipment_name
                                       FROM project_equipment pe
                                       LEFT JOIN equipment e ON pe.equipment_id = e.id
                                       WHERE pe.project_id = ?`).all(project.id) as ProjectEquipment[];

  res.json({ success: true, data: project });
});

router.post('/', authMiddleware, roleMiddleware('tutor', 'admin'), (req: Request, res: Response) => {
  const { name, tutor_id, start_date, end_date, description } = req.body;

  if (!name || !tutor_id || !start_date || !end_date) {
    res.status(400).json({ success: false, error: '缺少必填字段' });
    return;
  }

  const result = db.prepare(`INSERT INTO projects
    (name, tutor_id, start_date, end_date, description)
    VALUES (?, ?, ?, ?, ?)`).run(
    name, tutor_id, start_date, end_date, description || null
  );

  const project = db.prepare(`SELECT p.*, u.name as tutor_name
                              FROM projects p
                              LEFT JOIN users u ON p.tutor_id = u.id
                              WHERE p.id = ?`).get(result.lastInsertRowid) as Project;
  res.json({ success: true, data: project });
});

router.put('/:id', authMiddleware, roleMiddleware('tutor', 'admin'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;

  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  if (user.role === 'tutor' && project.tutor_id !== user.id) {
    res.status(403).json({ success: false, error: '无权修改该项目' });
    return;
  }

  const { name, tutor_id, start_date, end_date, description } = req.body;
  db.prepare(`UPDATE projects SET
    name = COALESCE(?, name), tutor_id = COALESCE(?, tutor_id),
    start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
    description = COALESCE(?, description)
    WHERE id = ?`).run(
    name, tutor_id, start_date, end_date, description, req.params.id
  );

  const updated = db.prepare(`SELECT p.*, u.name as tutor_name
                              FROM projects p
                              LEFT JOIN users u ON p.tutor_id = u.id
                              WHERE p.id = ?`).get(req.params.id) as Project;
  res.json({ success: true, data: updated });
});

router.delete('/:id', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);

  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  db.prepare('DELETE FROM project_members WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM project_equipment WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/members', authMiddleware, roleMiddleware('tutor', 'admin'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;

  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  if (user.role === 'tutor' && project.tutor_id !== user.id) {
    res.status(403).json({ success: false, error: '无权操作该项目' });
    return;
  }

  const { student_id } = req.body;
  if (!student_id) {
    res.status(400).json({ success: false, error: '缺少学生ID' });
    return;
  }

  const existing = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND student_id = ?').get(req.params.id, student_id);
  if (existing) {
    res.status(400).json({ success: false, error: '该学生已是项目成员' });
    return;
  }

  const result = db.prepare('INSERT INTO project_members (project_id, student_id) VALUES (?, ?)').run(req.params.id, student_id);
  const member = db.prepare(`SELECT pm.*, u.name as student_name
                             FROM project_members pm
                             LEFT JOIN users u ON pm.student_id = u.id
                             WHERE pm.id = ?`).get(result.lastInsertRowid) as ProjectMember;
  res.json({ success: true, data: member });
});

router.delete('/:id/members/:studentId', authMiddleware, roleMiddleware('tutor', 'admin'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;

  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  if (user.role === 'tutor' && project.tutor_id !== user.id) {
    res.status(403).json({ success: false, error: '无权操作该项目' });
    return;
  }

  db.prepare('DELETE FROM project_members WHERE project_id = ? AND student_id = ?').run(req.params.id, req.params.studentId);
  res.json({ success: true });
});

router.post('/:id/equipment', authMiddleware, roleMiddleware('tutor', 'admin'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;

  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  if (user.role === 'tutor' && project.tutor_id !== user.id) {
    res.status(403).json({ success: false, error: '无权操作该项目' });
    return;
  }

  const { equipment_id } = req.body;
  if (!equipment_id) {
    res.status(400).json({ success: false, error: '缺少设备ID' });
    return;
  }

  const existing = db.prepare('SELECT id FROM project_equipment WHERE project_id = ? AND equipment_id = ?').get(req.params.id, equipment_id);
  if (existing) {
    res.status(400).json({ success: false, error: '该设备已关联项目' });
    return;
  }

  const result = db.prepare('INSERT INTO project_equipment (project_id, equipment_id) VALUES (?, ?)').run(req.params.id, equipment_id);
  const equip = db.prepare(`SELECT pe.*, e.name as equipment_name
                            FROM project_equipment pe
                            LEFT JOIN equipment e ON pe.equipment_id = e.id
                            WHERE pe.id = ?`).get(result.lastInsertRowid) as ProjectEquipment;
  res.json({ success: true, data: equip });
});

router.delete('/:id/equipment/:equipmentId', authMiddleware, roleMiddleware('tutor', 'admin'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;

  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  if (user.role === 'tutor' && project.tutor_id !== user.id) {
    res.status(403).json({ success: false, error: '无权操作该项目' });
    return;
  }

  db.prepare('DELETE FROM project_equipment WHERE project_id = ? AND equipment_id = ?').run(req.params.id, req.params.equipmentId);
  res.json({ success: true });
});

router.get('/:id/usage-stats', authMiddleware, (req: Request, res: Response) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;

  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  const memberIds = db.prepare('SELECT student_id FROM project_members WHERE project_id = ?').all(req.params.id) as any[];
  const equipmentIds = db.prepare('SELECT equipment_id FROM project_equipment WHERE project_id = ?').all(req.params.id) as any[];

  const usageStats: any = { members: [], equipment_stats: [], total_usage_count: 0, total_reservation_count: 0 };

  for (const member of memberIds) {
    const memberInfo: any = db.prepare('SELECT id, name, username FROM users WHERE id = ?').get(member.student_id);

    let usageLogs: any[] = [];
    let reservations: any[] = [];
    let usageCount = 0;
    let reservationCount = 0;

    if (equipmentIds.length > 0) {
      const equipPlaceholders = equipmentIds.map(() => '?').join(',');
      usageLogs = db.prepare(`SELECT ul.*, e.name as equipment_name
                              FROM usage_logs ul
                              LEFT JOIN equipment e ON ul.equipment_id = e.id
                              WHERE ul.user_id = ? AND ul.equipment_id IN (${equipPlaceholders})
                              ORDER BY ul.checkin_time DESC`).all(member.student_id, ...equipmentIds.map(e => e.equipment_id));

      reservations = db.prepare(`SELECT r.*, e.name as equipment_name
                                 FROM reservations r
                                 LEFT JOIN equipment e ON r.equipment_id = e.id
                                 WHERE r.student_id = ? AND r.equipment_id IN (${equipPlaceholders})
                                 ORDER BY r.created_at DESC`).all(member.student_id, ...equipmentIds.map(e => e.equipment_id));

      usageCount = usageLogs.length;
      reservationCount = reservations.length;
    }

    usageStats.members.push({
      ...memberInfo,
      usage_logs: usageLogs,
      reservations: reservations,
      usage_count: usageCount,
      reservation_count: reservationCount
    });

    usageStats.total_usage_count += usageCount;
    usageStats.total_reservation_count += reservationCount;
  }

  for (const equip of equipmentIds) {
    const equipInfo: any = db.prepare('SELECT id, name FROM equipment WHERE id = ?').get(equip.equipment_id);
    const usageCount = db.prepare('SELECT COUNT(*) as count FROM usage_logs WHERE equipment_id = ?').get(equip.equipment_id) as any;
    const reservationCount = db.prepare('SELECT COUNT(*) as count FROM reservations WHERE equipment_id = ?').get(equip.equipment_id) as any;
    usageStats.equipment_stats.push({
      ...equipInfo,
      usage_count: usageCount?.count || 0,
      reservation_count: reservationCount?.count || 0
    });
  }

  res.json({ success: true, data: usageStats });
});

export default router;
