import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { users_role } from '@prisma/client';

const router = Router();

const SubtopicSchema = z.object({
  name: z.string().min(1).max(100),
  topicId: z.string().uuid(),
  description: z.string().optional(),
  validFrom: z.date(),
  validTo: z.date().optional()
});

// Get all subtopics
router.get('/', authenticate, async (req, res, next) => {
  try {
    const subtopics = await prisma.subtopics.findMany({
      include: {
        questions: true
      }
    });
    res.json(subtopics);
  } catch (error) {
    next(error);
  }
});

// Get subtopics by topic ID
router.get('/topic/:topicId', authenticate, async (req, res, next) => {
  try {
    const subtopics = await prisma.subtopics.findMany({
      where: { topic_id: req.params.topicId },
      include: {
        questions: true
      }
    });
    res.json(subtopics);
  } catch (error) {
    next(error);
  }
});

// Create subtopic
router.post('/',
  authenticate,
  authorize([users_role.Admin, users_role.Tutor]),
  validateRequest(SubtopicSchema),
  async (req, res, next) => {
    try {
      const subtopic = await prisma.subtopics.create({
        data: {
          subtopic_id: req.body.id,
          name: req.body.name,
          description: req.body.description,
          topic_id: req.body.topicId,
          valid_from: req.body.validFrom,
          valid_to: req.body.validTo
        },
        include: {
          questions: true
        }
      });
      res.status(201).json(subtopic);
    } catch (error) {
      next(error);
    }
});

// Update subtopic
router.put('/:id',
  authenticate,
  authorize([users_role.Admin, users_role.Tutor]),
  validateRequest(SubtopicSchema),
  async (req, res, next) => {
    try {
      const subtopic = await prisma.subtopics.update({
        where: { subtopic_id: req.params.id },
        data: {
          name: req.body.name,
          description: req.body.description,
          topic_id: req.body.topicId,
          valid_from: req.body.validFrom,
          valid_to: req.body.validTo
        },
        include: {
          questions: true
        }
      });
      res.json(subtopic);
    } catch (error) {
      next(error);
    }
});

// Delete subtopic
router.delete('/:id',
  authenticate,
  authorize([users_role.Admin]),
  async (req, res, next) => {
    try {
      await prisma.subtopics.delete({
        where: { subtopic_id: req.params.id }
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
});

export { router as subtopicsRouter };