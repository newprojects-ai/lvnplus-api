import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { users_role } from '@prisma/client';

const router = Router();

const TopicSchema = z.object({
  name: z.string().min(1).max(100),
  subjectId: z.string().uuid(),
  description: z.string().optional(),
  validFrom: z.date(),
  validTo: z.date().optional()
});

// Get all topics with subtopics
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

// Get topics by subject ID
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

// Create topic
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

// Update topic
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

// Delete topic
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