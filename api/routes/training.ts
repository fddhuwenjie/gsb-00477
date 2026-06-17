import express, { type Request, type Response } from 'express';
import db from '../db/database.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';
import type { Training, TrainingQuestion, TrainingQualification, User } from '../../shared/types.js';

const router = express.Router();

router.get('/', authMiddleware, (req: Request, res: Response) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM trainings WHERE 1=1';
  const params: any[] = [];
  
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY created_at DESC';
  
  const trainings = db.prepare(sql).all(...params) as Training[];
  res.json({ success: true, data: trainings });
});

router.post('/', authMiddleware, roleMiddleware('admin'), (req: Request, res: Response) => {
  const { name, content, category, questions } = req.body;
  
  if (!name || !content || !category || !questions || questions.length !== 3) {
    res.status(400).json({ success: false, error: '请填写完整培训信息和3道考核题目' });
    return;
  }

  const result = db.prepare('INSERT INTO trainings (name, content, category) VALUES (?, ?, ?)').run(name, content, category);
  
  const insertQuestion = db.prepare(`INSERT INTO training_questions 
    (training_id, question_text, option_a, option_b, option_c, option_d, correct_answer) 
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  
  for (const q of questions) {
    insertQuestion.run(result.lastInsertRowid, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer);
  }

  const training = db.prepare('SELECT * FROM trainings WHERE id = ?').get(result.lastInsertRowid) as Training;
  res.json({ success: true, data: training });
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const training = db.prepare('SELECT * FROM trainings WHERE id = ?').get(req.params.id) as Training;
  
  if (!training) {
    res.status(404).json({ success: false, error: '培训不存在' });
    return;
  }

  const questions = db.prepare('SELECT * FROM training_questions WHERE training_id = ?').all(req.params.id) as TrainingQuestion[];
  (training as any).questions = questions;

  res.json({ success: true, data: training });
});

router.post('/:id/take', authMiddleware, roleMiddleware('student'), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { answers } = req.body;
  
  if (!answers || typeof answers !== 'object') {
    res.status(400).json({ success: false, error: '请提交答案' });
    return;
  }

  const training = db.prepare('SELECT * FROM trainings WHERE id = ?').get(req.params.id) as any;
  if (!training) {
    res.status(404).json({ success: false, error: '培训不存在' });
    return;
  }

  const questions = db.prepare('SELECT * FROM training_questions WHERE training_id = ?').all(req.params.id) as TrainingQuestion[];
  if (questions.length === 0) {
    res.status(400).json({ success: false, error: '该培训暂无考核题目' });
    return;
  }

  let correctCount = 0;
  for (const q of questions) {
    const userAnswer = answers[q.id] || answers[String(q.id)];
    if (userAnswer === q.correct_answer) {
      correctCount++;
    }
  }

  const passed = correctCount === questions.length;
  
  if (passed) {
    const today = new Date();
    const expiry = new Date(today);
    expiry.setFullYear(expiry.getFullYear() + 1);
    
    const existing = db.prepare('SELECT id FROM training_qualifications WHERE user_id = ? AND training_id = ?').get(user.id, training.id);
    if (existing) {
      db.prepare(`UPDATE training_qualifications SET 
        passed_date = date('now'), expiry_date = ?, is_valid = 1 
        WHERE id = ?`).run(expiry.toISOString().split('T')[0], (existing as any).id);
    } else {
      db.prepare(`INSERT INTO training_qualifications 
        (user_id, training_id, category, passed_date, expiry_date, is_valid) 
        VALUES (?, ?, ?, date('now'), ?, 1)`).run(
        user.id, training.id, training.category, expiry.toISOString().split('T')[0]
      );
    }
  }

  res.json({ 
    success: true, 
    data: { 
      passed, 
      correctCount, 
      totalCount: questions.length,
      message: passed ? '考核通过，已获得设备使用资格！' : `考核未通过，您答对了${correctCount}/${questions.length}题，请重新学习后再次考核。`
    } 
  });
});

router.get('/qualifications/list', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { user_id } = req.query;
  const targetUserId = user_id || user.id;

  const qualifications = db.prepare(`SELECT tq.*, t.name as training_name 
    FROM training_qualifications tq 
    LEFT JOIN trainings t ON tq.training_id = t.id 
    WHERE tq.user_id = ? ORDER BY tq.passed_date DESC`).all(targetUserId) as TrainingQualification[];
  
  res.json({ success: true, data: qualifications });
});

export default router;
