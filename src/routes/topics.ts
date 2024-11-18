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
 *     Subtopic:
 *       type: object
 *       properties:
 *         subtopic_id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         topic_id:
 *           type: string
 *           format: uuid
 *         valid_from:
 *           type: string
 *           format: date-time
 *         valid_to:
 *           type: string
 *           format: date-time
 *     Topic:
 *       type: object
 *       properties:
 *         topic_id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         subject_id:
 *           type: string
 *           format: uuid
 *         valid_from:
 *           type: string
 *           format: date-time
 *         valid_to:
 *           type: string
 *           format: date-time
 *         subtopics:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Subtopic'
 *     TopicRequest:
 *       type: object
 *       required:
 *         - name
 *         - subjectId
 *         - validFrom
 *       properties:
 *         name:
 *           type: string
 *         subjectId:
 *           type: string
 *           format: uuid
 *         description:
 *           type: string
 *         validFrom:
 *           type: string
 *           format: date-time
 *         validTo:
 *           type: string
 *           format: date-time
 */

const TopicSchema = z.object({
  name: z.string().min(1).max(100),
  subjectId: z.string().uuid(),
  description: z.string().optional(),
  validFrom: z.date(),
  validTo: z.date().optional()
});

/**
 * @swagger
 * /api/topics:
 *   get:
 *     tags: [Topics]
 *     summary: Get all topics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of topics with subtopics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Topic'
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const topics = await prisma.topics.findMany({
      include: {
        subtopics: true
      }
    });
    res.json(topics);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/topics/subject/{subjectId}:
 *   get:
 *     tags: [Topics]
 *     summary: Get topics by subject ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of topics for the subject
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Topic'
 */
router.get('/subject/:subjectId', authenticate, async (req, res, next) => {
  try {
    const topics = await prisma.topics.findMany({
      where: { subject_id: req.params.subjectId },
      include: {
        subtopics: true
      }
    });
    res.json(topics);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/topics:
 *   post:
 *     tags: [Topics]
 *     summary: Create a new topic
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TopicRequest'
 *     responses:
 *       201:
 *         description: Topic created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Topic'
 *       403:
 *         description: Insufficient permissions
 */
router.post('/',
  authenticate,
  authorize([users_role.Admin, users_role.Tutor]),
  validateRequest(TopicSchema),
  async (req, res, next) => {
    try {
      const topic = await prisma.topics.create({
        data: {
          topic_id: req.body.id,
          name: req.body.name,
          description: req.body.description,
          subject_id: req.body.subjectId,
          valid_from: req.body.validFrom,
          valid_to: req.body.validTo
        },
        include: {
          subtopics: true
        }
      });
      res.status(201).json(topic);
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/topics/{id}:
 *   put:
 *     tags: [Topics]
 *     summary: Update a topic
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
 *             $ref: '#/components/schemas/TopicRequest'
 *     responses:
 *       200:
 *         description: Topic updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Topic'
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Topic not found
 */
router.put('/:id',
  authenticate,
  authorize([users_role.Admin, users_role.Tutor]),
  validateRequest(TopicSchema),
  async (req, res, next) => {
    try {
      const topic = await prisma.topics.update({
        where: { topic_id: req.params.id },
        data: {
          name: req.body.name,
          description: req.body.description,
          subject_id: req.body.subjectId,
          valid_from: req.body.validFrom,
          valid_to: req.body.validTo
        },
        include: {
          subtopics: true
        }
      });
      res.json(topic);
    } catch (error) {
      next(error);
    }
});

/**
 * @swagger
 * /api/topics/{id}:
 *   delete:
 *     tags: [Topics]
 *     summary: Delete a topic
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
 *         description: Topic deleted successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Topic not found
 */
router.delete('/:id',
  authenticate,
  authorize([users_role.Admin]),
  async (req, res, next) => {
    try {
      await prisma.topics.delete({
        where: { topic_id: req.params.id }
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
});

export { router as topicsRouter };