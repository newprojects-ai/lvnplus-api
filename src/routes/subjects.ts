import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { users_role } from '@prisma/client';

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

// Create subject (Admin/Tutor only)
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

// Update subject
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

// Delete subject
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