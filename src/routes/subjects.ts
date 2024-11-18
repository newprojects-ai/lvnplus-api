import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { users_role } from '@prisma/client';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Subject:
 *       type: object
 *       properties:
 *         subject_id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         exam_id:
 *           type: string
 *           format: uuid
 *         topics:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Topic'
 *     SubjectRequest:
 *       type: object
 *       required:
 *         - name
 *         - examId
 *       properties:
 *         name:
 *           type: string
 *         examId:
 *           type: string
 *           format: uuid
 */

const SubjectSchema = z.object({
  name: z.string().min(1).max(100),
  examId: z.string().uuid()
});

/**
 * @swagger
 * /api/subjects:
 *   get:
 *     tags: [Subjects]
 *     summary: Get all subjects
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of subjects with topics and subtopics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Subject'
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const subjects = await prisma.subjects.findMany({
      include: {
        topics: {
          include: {
            subtopics: true
          }
        }
      }
    });
    res.json(subjects);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/subjects/{id}:
 *   get:
 *     tags: [Subjects]
 *     summary: Get subject by ID
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
 *         description: Subject details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subject'
 *       404:
 *         description: Subject not found
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const subject = await prisma.subjects.findUnique({
      where: { subject_id: req.params.id },
      include: {
        topics: {
          include: {
            subtopics: true
          }
        }
      }
    });
    
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json(subject);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/subjects:
 *   post:
 *     tags: [Subjects]
 *     summary: Create a new subject
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubjectRequest'
 *     responses:
 *       201:
 *         description: Subject created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subject'
 *       403:
 *         description: Insufficient permissions
 */
router.post('/', 
  authenticate, 
  authorize([users_role.Admin, users_role.Tutor]),
  validateRequest(SubjectSchema),
  async (req, res, next) => {
    try {
      const subject = await prisma.subjects.create({
        data: {
          subject_id: req.body.id,
          name: req.body.name,
          exam_id: req.body.examId
        },
        include: {
          topics: true
        }
      });
      res.status(201).json(subject);
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/subjects/{id}:
 *   put:
 *     tags: [Subjects]
 *     summary: Update a subject
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
 *             $ref: '#/components/schemas/SubjectRequest'
 *     responses:
 *       200:
 *         description: Subject updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subject'
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Subject not found
 */
router.put('/:id',
  authenticate,
  authorize([users_role.Admin, users_role.Tutor]),
  validateRequest(SubjectSchema),
  async (req, res, next) => {
    try {
      const subject = await prisma.subjects.update({
        where: { subject_id: req.params.id },
        data: {
          name: req.body.name,
          exam_id: req.body.examId
        },
        include: {
          topics: true
        }
      });
      res.json(subject);
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/subjects/{id}:
 *   delete:
 *     tags: [Subjects]
 *     summary: Delete a subject
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
 *         description: Subject deleted successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Subject not found
 */
router.delete('/:id',
  authenticate,
  authorize([users_role.Admin]),
  async (req, res, next) => {
    try {
      await prisma.subjects.delete({
        where: { subject_id: req.params.id }
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
});

export { router as subjectsRouter };