import express, { type Request, type Response } from 'express';
import db from '../db/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/templates', authMiddleware, (req: Request, res: Response) => {
  const templates = db.prepare(`SELECT rt.*, u.name as creator_name
    FROM report_templates rt
    LEFT JOIN users u ON rt.created_by = u.id
    ORDER BY rt.created_at DESC`).all() as any[];

  const result = templates.map(t => ({
    ...t,
    dimensions: t.dimensions ? t.dimensions.split(',') : [],
    metrics: t.metrics ? t.metrics.split(',') : []
  }));

  res.json({ success: true, data: result });
});

router.get('/templates/:id', authMiddleware, (req: Request, res: Response) => {
  const template = db.prepare(`SELECT rt.*, u.name as creator_name
    FROM report_templates rt
    LEFT JOIN users u ON rt.created_by = u.id
    WHERE rt.id = ?`).get(req.params.id) as any;

  if (!template) {
    res.status(404).json({ success: false, error: '模板不存在' });
    return;
  }

  template.dimensions = template.dimensions ? template.dimensions.split(',') : [];
  template.metrics = template.metrics ? template.metrics.split(',') : [];

  res.json({ success: true, data: template });
});

router.post('/templates', authMiddleware, roleMiddleware('admin', 'tutor'), (req: Request, res: Response) => {
  const user = (req as any).user as any;
  const { name, dimensions, metrics, date_range_start, date_range_end } = req.body;

  if (!name || !dimensions || !metrics) {
    res.status(400).json({ success: false, error: '缺少必填字段' });
    return;
  }

  const dimensionsStr = Array.isArray(dimensions) ? dimensions.join(',') : dimensions;
  const metricsStr = Array.isArray(metrics) ? metrics.join(',') : metrics;

  const result = db.prepare(`INSERT INTO report_templates
    (name, dimensions, metrics, date_range_start, date_range_end, created_by)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    name, dimensionsStr, metricsStr,
    date_range_start || null, date_range_end || null, user.id
  );

  const template = db.prepare(`SELECT rt.*, u.name as creator_name
    FROM report_templates rt
    LEFT JOIN users u ON rt.created_by = u.id
    WHERE rt.id = ?`).get(result.lastInsertRowid) as any;

  template.dimensions = template.dimensions ? template.dimensions.split(',') : [];
  template.metrics = template.metrics ? template.metrics.split(',') : [];

  res.json({ success: true, data: template });
});

router.delete('/templates/:id', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const template = db.prepare('SELECT * FROM report_templates WHERE id = ?').get(req.params.id);
  if (!template) {
    res.status(404).json({ success: false, error: '模板不存在' });
    return;
  }

  db.prepare('DELETE FROM report_templates WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: '删除成功' });
});

function buildReportQuery(dimensions: string[], metrics: string[], dateRangeStart?: string, dateRangeEnd?: string): { sql: string; params: any[] } {
  const selectParts: string[] = [];
  const groupByParts: string[] = [];
  const joinParts: string[] = [];
  const whereParts: string[] = [];
  const params: any[] = [];

  for (const dim of dimensions) {
    switch (dim) {
      case 'equipment':
        selectParts.push('e.id as equipment_id', 'e.name as equipment_name');
        groupByParts.push('e.id', 'e.name');
        joinParts.push('LEFT JOIN equipment e ON ul.equipment_id = e.id');
        break;
      case 'user':
        selectParts.push('u.id as user_id', 'u.name as user_name');
        groupByParts.push('u.id', 'u.name');
        joinParts.push('LEFT JOIN users u ON ul.user_id = u.id');
        break;
      case 'lab':
        selectParts.push('l.id as lab_id', 'l.name as lab_name');
        groupByParts.push('l.id', 'l.name');
        joinParts.push('LEFT JOIN equipment e2 ON ul.equipment_id = e2.id');
        joinParts.push('LEFT JOIN labs l ON e2.lab_id = l.id');
        break;
      case 'time':
        selectParts.push("strftime('%Y-%m', ul.checkin_time) as month");
        groupByParts.push("strftime('%Y-%m', ul.checkin_time)");
        break;
    }
  }

  for (const metric of metrics) {
    switch (metric) {
      case 'usage_count':
        selectParts.push('COUNT(ul.id) as usage_count');
        break;
      case 'usage_duration':
        selectParts.push("COALESCE(SUM(CASE WHEN ul.checkout_time IS NOT NULL THEN CAST((julianday(ul.checkout_time) - julianday(ul.checkin_time)) * 24 AS REAL) ELSE 0 END), 0) as usage_duration");
        break;
      case 'fault_count':
        selectParts.push('(SELECT COUNT(*) FROM fault_reports fr WHERE fr.equipment_id = ul.equipment_id' +
          (dateRangeStart ? ' AND fr.created_at >= ?' : '') +
          (dateRangeEnd ? ' AND fr.created_at <= ?' : '') +
          ') as fault_count');
        if (dateRangeStart) params.push(dateRangeStart);
        if (dateRangeEnd) params.push(dateRangeEnd);
        break;
      case 'maintenance_cost':
        selectParts.push('(SELECT COALESCE(SUM(mr.cost), 0) FROM maintenance_records mr WHERE mr.equipment_id = ul.equipment_id' +
          (dateRangeStart ? ' AND mr.maintenance_date >= ?' : '') +
          (dateRangeEnd ? ' AND mr.maintenance_date <= ?' : '') +
          ') as maintenance_cost');
        if (dateRangeStart) params.push(dateRangeStart);
        if (dateRangeEnd) params.push(dateRangeEnd);
        break;
    }
  }

  if (dateRangeStart) {
    whereParts.push('ul.checkin_time >= ?');
    params.unshift(dateRangeStart);
  }
  if (dateRangeEnd) {
    whereParts.push('ul.checkin_time <= ?');
    if (dateRangeStart) {
      params.splice(1, 0, dateRangeEnd);
    } else {
      params.unshift(dateRangeEnd);
    }
  }

  let sql = `SELECT ${selectParts.join(', ')} FROM usage_logs ul ${joinParts.join(' ')}`;
  if (whereParts.length > 0) {
    sql += ` WHERE ${whereParts.join(' AND ')}`;
  }
  if (groupByParts.length > 0) {
    sql += ` GROUP BY ${groupByParts.join(', ')}`;
  }

  return { sql, params };
}

router.post('/generate', authMiddleware, (req: Request, res: Response) => {
  const { template_id, dimensions, metrics, date_range_start, date_range_end, date_start, date_end } = req.body;

  let dims = dimensions;
  let mets = metrics;
  let dateStart = date_start || date_range_start;
  let dateEnd = date_end || date_range_end;

  if (template_id) {
    const template = db.prepare('SELECT * FROM report_templates WHERE id = ?').get(template_id) as any;
    if (!template) {
      res.status(404).json({ success: false, error: '模板不存在' });
      return;
    }
    dims = template.dimensions ? template.dimensions.split(',') : [];
    mets = template.metrics ? template.metrics.split(',') : [];
    dateStart = dateStart || template.date_range_start;
    dateEnd = dateEnd || template.date_range_end;
  }

  if (!dims || !mets || dims.length === 0 || mets.length === 0) {
    res.status(400).json({ success: false, error: '缺少维度或指标' });
    return;
  }

  const { sql, params } = buildReportQuery(dims, mets, dateStart, dateEnd);
  const rows = db.prepare(sql).all(...params);
  res.json({ success: true, data: rows });
});

router.get('/export/csv', authMiddleware, (req: Request, res: Response) => {
  const { template_id, dimensions, metrics, date_range_start, date_range_end, date_start, date_end } = req.query as any;

  let dims: string[] = dimensions ? (Array.isArray(dimensions) ? dimensions : dimensions.split(',')) : [];
  let mets: string[] = metrics ? (Array.isArray(metrics) ? metrics : metrics.split(',')) : [];
  let dateStart = date_start || date_range_start;
  let dateEnd = date_end || date_range_end;

  if (template_id) {
    const template = db.prepare('SELECT * FROM report_templates WHERE id = ?').get(template_id) as any;
    if (!template) {
      res.status(404).json({ success: false, error: '模板不存在' });
      return;
    }
    dims = template.dimensions ? template.dimensions.split(',') : [];
    mets = template.metrics ? template.metrics.split(',') : [];
    dateStart = dateStart || template.date_range_start;
    dateEnd = dateEnd || template.date_range_end;
  }

  if (dims.length === 0 || mets.length === 0) {
    res.status(400).json({ success: false, error: '缺少维度或指标' });
    return;
  }

  const { sql, params } = buildReportQuery(dims, mets, dateStart, dateEnd);
  const rows = db.prepare(sql).all(...params) as any[];

  if (rows.length === 0) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
    res.send('');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvLines: string[] = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map(h => {
      const val = String(row[h] ?? '');
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    });
    csvLines.push(values.join(','));
  }

  const csv = '\uFEFF' + csvLines.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
  res.send(csv);
});

router.get('/export/pdf', authMiddleware, (req: Request, res: Response) => {
  const { template_id, dimensions, metrics, date_range_start, date_range_end, date_start, date_end } = req.query as any;

  let dims: string[] = dimensions ? (Array.isArray(dimensions) ? dimensions : dimensions.split(',')) : [];
  let mets: string[] = metrics ? (Array.isArray(metrics) ? metrics : metrics.split(',')) : [];
  let dateStart = date_start || date_range_start;
  let dateEnd = date_end || date_range_end;

  if (template_id) {
    const template = db.prepare('SELECT * FROM report_templates WHERE id = ?').get(template_id) as any;
    if (!template) {
      res.status(404).json({ success: false, error: '模板不存在' });
      return;
    }
    dims = template.dimensions ? template.dimensions.split(',') : [];
    mets = template.metrics ? template.metrics.split(',') : [];
    dateStart = dateStart || template.date_range_start;
    dateEnd = dateEnd || template.date_range_end;
  }

  if (dims.length === 0 || mets.length === 0) {
    res.status(400).json({ success: false, error: '缺少维度或指标' });
    return;
  }

  const { sql, params } = buildReportQuery(dims, mets, dateStart, dateEnd);
  const rows = db.prepare(sql).all(...params) as any[];

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  const headerLabels: Record<string, string> = {
    equipment_id: '设备ID',
    equipment_name: '设备名称',
    user_id: '用户ID',
    user_name: '用户名称',
    lab_id: '实验室ID',
    lab_name: '实验室名称',
    month: '月份',
    usage_count: '使用次数',
    usage_duration: '使用时长(小时)',
    fault_count: '故障次数',
    maintenance_cost: '维护费用'
  };

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: "Microsoft YaHei", "SimHei", sans-serif; padding: 20px; }
    h2 { text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #333; padding: 8px 12px; text-align: center; }
    th { background-color: #4a90d9; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
  </style></head><body><h2>自定义报告</h2><table><thead><tr>`;

  for (const h of headers) {
    html += `<th>${headerLabels[h] || h}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const row of rows) {
    html += '<tr>';
    for (const h of headers) {
      html += `<td>${row[h] ?? ''}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table></body></html>';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
