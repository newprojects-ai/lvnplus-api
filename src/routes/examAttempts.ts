import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';
import db from '../db';
import { randomUUID } from 'crypto';

const router = Router();

const ExamAttemptSchema = z.object({
  studentId: z.string().uuid(),
  score: z.number().min(0),
  answers: z.string(),
  duration: z.number().min(1),
});

// Get student's exam attempts
router.get('/student/:studentId', (req, res) => {
  const attempts = db.prepare(
    'SELECT * FROM exam_attempts WHERE student_id = ? ORDER BY created_at DESC'
  ).all(req.params.studentId);
  res.json(attempts);
});

// Create exam attempt
router.post('/', validateRequest(ExamAttemptSchema), (req, res) => {
  const id = randomUUID();
  const { studentId, score, answers, duration } = req.body;

  db.prepare(`
    INSERT INTO exam_attempts (id, student_id, score, answers, duration)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, studentId, score, answers, duration);

  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(id);
  res.status(201).json(attempt);
});

// Get exam attempt statistics
router.get('/statistics/:studentId', (req, res) => {
  const attempts = db.prepare(
    'SELECT * FROM exam_attempts WHERE student_id = ? ORDER BY created_at DESC'
  ).all(req.params.studentId);

  const stats = {
    totalAttempts: attempts.length,
    averageScore: attempts.reduce((acc, curr) => acc + curr.score, 0) / attempts.length || 0,
    highestScore: Math.max(...attempts.map(a => a.score), 0),
    averageDuration: attempts.reduce((acc, curr) => acc + curr.duration, 0) / attempts.length || 0,
  };

  res.json(stats);
});

export { router as examAttemptsRouter };