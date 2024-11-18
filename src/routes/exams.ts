import { Response, NextFunction } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { users_role as UserRole} from '@prisma/client';
import { AuthRequest } from '../types/auth';
import { Router } from 'express';

const router = Router();

const ExamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional()
});

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
          tests: true,
          generated_practice_tests: true
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
      const exam = await prisma.exams.create({
        data: {
          exam_id: req.body.id,
          name: req.body.name,
          description: req.body.description
        },
        include: {
          tests: true,
          generated_practice_tests: true
        }
      });
      res.status(201).json(exam);
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/exams/{id}:
 *   get:
 *     tags: [Exams]
 *     summary: Get exam by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Exam details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Exam'
 *       404:
 *         description: Exam not found
 */
router.get('/:id',
  authenticate as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const exam = await prisma.exams.findUnique({
        where: { exam_id: req.params.id },
        include: {
          tests: true,
          generated_practice_tests: true
        }
      });

      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      res.json(exam);
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/exams/{id}:
 *   put:
 *     tags: [Exams]
 *     summary: Update an exam
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExamRequest'
 *     responses:
 *       200:
 *         description: Exam updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Exam'
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Exam not found
 */
router.put('/:id',
  authenticate as any,
  authorize([UserRole.Admin]) as any,
  validateRequest(ExamSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const exam = await prisma.exams.update({
        where: { exam_id: req.params.id },
        data: {
          name: req.body.name,
          description: req.body.description
        },
        include: {
          tests: true,
          generated_practice_tests: true
        }
      });
      res.json(exam);
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/exams/{id}:
 *   delete:
 *     tags: [Exams]
 *     summary: Delete an exam
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Exam deleted successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Exam not found
 */
router.delete('/:id',
  authenticate as any,
  authorize([UserRole.Admin]) as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await prisma.exams.delete({
        where: { exam_id: req.params.id }
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
});

export { router as examsRouter };