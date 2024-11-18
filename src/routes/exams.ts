import { Response, NextFunction } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { users_role as UserRole} from '@prisma/client';
import { AuthRequest } from '../types/auth';
import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Exam:
 *       type: object
 *       properties:
 *         exam_id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         subjects:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Subject'
 *     ExamRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 */

const ExamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional()
});

/**
 * @swagger
 * /api/exams:
 *   get:
 *     tags: [Exams]
 *     summary: Get all exams
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of exams
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Exam'
 */
router.get('/', 
  authenticate as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const exams = await prisma.exams.findMany({
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

/**
 * @swagger
 * /api/exams:
 *   post:
 *     tags: [Exams]
 *     summary: Create a new exam
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExamRequest'
 *     responses:
 *       201:
 *         description: Exam created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Exam'
 *       403:
 *         description: Insufficient permissions
 */
router.post('/', 
  authenticate as any,
  authorize([UserRole.Admin]) as any,
  validateRequest(ExamSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const exams = await prisma.exams.create({
        data: req.body,
        include: {
          subjects: true
        }
      });
      res.status(201).json(exams);
    } catch (error) {
      next(error);
    }
});

export { router as examsRouter };