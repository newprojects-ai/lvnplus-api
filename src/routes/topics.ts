import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { UserRole } from '@prisma/client';

const router = Router();

const TopicSchema = z.object({
  name: z.string().min(1).max(100),
  subjectId: z.string().uuid()
});

// Get all topics with subtopics
router.get('/', authenticate, async (req, res, next) => {
  try {
    const topics = await prisma.topic.findMany({
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
    const topics = await prisma.topic.findMany({
      where: { subjectId: req.params.subjectId },
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
  authorize([UserRole.ADMIN, UserRole.TUTOR]),
  validateRequest(TopicSchema),
  async (req, res, next) => {
    try {
      const topic = await prisma.topic.create({
        data: req.body,
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
  authorize([UserRole.ADMIN, UserRole.TUTOR]),
  validateRequest(TopicSchema),
  async (req, res, next) => {
    try {
      const topic = await prisma.topic.update({
        where: { id: req.params.id },
        data: req.body,
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
  authorize([UserRole.ADMIN]),
  async (req, res, next) => {
    try {
      await prisma.topic.delete({
        where: { id: req.params.id }
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
});

export { router as topicsRouter };