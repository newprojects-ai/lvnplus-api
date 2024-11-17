import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { UserRole } from '@prisma/client';

const router = Router();

const ExamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional()
});

// Get all exams
router.get('/', authenticate, async (req, res, next) => {
  try {
    const exams = await prisma.exam.findMany({
      include: {
        subjects: {
          include: {
            topics: {
              include: {
                subtopics: true
              }
            }
          }
        }
      }
    });
    res.json(exams);
  } catch (error) {
    next(error);
  }
});

// Create exam (Admin only)
router.post('/', 
  authenticate, 
  authorize([UserRole.ADMIN]), 
  validateRequest(ExamSchema), 
  async (req, res, next) => {
    try {
      const exam = await prisma.exam.create({
        data: req.body,
        include: {
          subjects: true
        }
      });
      res.status(201).json(exam);
    } catch (error) {
      next(error);
    }
});

export { router as examsRouter };