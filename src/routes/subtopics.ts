import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { UserRole } from '@prisma/client';

const router = Router();

const SubtopicSchema = z.object({
  name: z.string().min(1).max(100),
  topicId: z.string().uuid()
});

// Get all subtopics
router.get('/', authenticate, async (req, res, next) => {
  try {
    const subtopics = await prisma.subtopic.findMany({
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
    const subtopics = await prisma.subtopic.findMany({
      where: { topicId: req.params.topicId },
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
  authorize([UserRole.ADMIN, UserRole.TUTOR]),
  validateRequest(SubtopicSchema),
  async (req, res, next) => {
    try {
      const subtopic = await prisma.subtopic.create({
        data: req.body,
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
  authorize([UserRole.ADMIN, UserRole.TUTOR]),
  validateRequest(SubtopicSchema),
  async (req, res, next) => {
    try {
      const subtopic = await prisma.subtopic.update({
        where: { id: req.params.id },
        data: req.body,
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
  authorize([UserRole.ADMIN]),
  async (req, res, next) => {
    try {
      await prisma.subtopic.delete({
        where: { id: req.params.id }
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
});

export { router as subtopicsRouter };