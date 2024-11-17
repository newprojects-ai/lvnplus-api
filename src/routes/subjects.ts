import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { users_role} from '@prisma/client';

const router = Router();

const SubjectSchema = z.object({
  name: z.string().min(1).max(100),
  examId: z.string().uuid()
});

// Get all subjects with topics and subtopics
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

// Get subject by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const subject = await prisma.subject.findUnique({
      where: { id: req.params.id },
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

// Create subject (Admin/Tutor only)
router.post('/', 
  authenticate, 
  authorize([UserRole.ADMIN, UserRole.TUTOR]),
  validateRequest(SubjectSchema),
  async (req, res, next) => {
    try {
      const subject = await prisma.subject.create({
        data: req.body,
        include: {
          topics: true
        }
      });
      res.status(201).json(subject);
    } catch (error) {
      next(error);
    }
});

// Update subject
router.put('/:id',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.TUTOR]),
  validateRequest(SubjectSchema),
  async (req, res, next) => {
    try {
      const subject = await prisma.subject.update({
        where: { id: req.params.id },
        data: req.body,
        include: {
          topics: true
        }
      });
      res.json(subject);
    } catch (error) {
      next(error);
    }
});

// Delete subject
router.delete('/:id',
  authenticate,
  authorize([UserRole.ADMIN]),
  async (req, res, next) => {
    try {
      await prisma.subject.delete({
        where: { id: req.params.id }
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
});

export { router as subjectsRouter };