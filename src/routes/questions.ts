import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { UserRole } from '@prisma/client';

const router = Router();

const QuestionSchema = z.object({
  questionText: z.string().min(1),
  options: z.array(z.string()).min(2),
  correctAnswer: z.string(),
  subtopicId: z.string().uuid(),
  difficultyId: z.number()
});

const PaginationSchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  difficulty: z.string().optional(),
  subtopicId: z.string().optional(),
  topicId: z.string().optional(),
  subjectId: z.string().optional(),
  search: z.string().optional()
});

// Get random questions for practice tests
router.get('/random/practice', authenticate, async (req, res, next) => {
  try {
    const count = parseInt(req.query.count as string) || 10;
    const difficultyId = parseInt(req.query.difficultyId as string);
    const subtopicIds = (req.query.subtopicIds as string).split(',');

    const questions = await prisma.question.findMany({
      where: {
        AND: [
          { difficultyId: difficultyId },
          { subtopicId: { in: subtopicIds } }
        ]
      },
      take: count,
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Shuffle the questions array
    const shuffledQuestions = questions
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);

    res.json(shuffledQuestions.slice(0, count));
  } catch (error) {
    next(error);
  }
});

// Get questions with pagination and filters
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { 
      page, 
      limit, 
      difficulty, 
      subtopicId, 
      topicId, 
      subjectId, 
      search 
    } = await PaginationSchema.parseAsync(req.query);

    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where: any = {};

    if (difficulty) {
      where.difficultyId = parseInt(difficulty);
    }

    if (subtopicId) {
      where.subtopicId = subtopicId;
    }

    if (topicId) {
      where.subtopic = { topicId };
    }

    if (subjectId) {
      where.subtopic = {
        ...where.subtopic,
        topic: { subjectId }
      };
    }

    if (search) {
      where.questionText = { contains: search };
    }

    // Get total count for pagination
    const total = await prisma.question.count({ where });

    // Get questions
    const questions = await prisma.question.findMany({
      where,
      include: {
        subtopic: {
          include: {
            topic: {
              include: {
                subject: true
              }
            }
          }
        },
        difficulty: true
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      data: questions,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get question by ID
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: {
        subtopic: {
          include: {
            topic: {
              include: {
                subject: true
              }
            }
          }
        },
        difficulty: true
      }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json(question);
  } catch (error) {
    next(error);
  }
});

// Create question
router.post('/',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.TUTOR]),
  validateRequest(QuestionSchema),
  async (req, res, next) => {
    try {
      const question = await prisma.question.create({
        data: {
          ...req.body,
          options: JSON.stringify(req.body.options)
        },
        include: {
          subtopic: {
            include: {
              topic: {
                include: {
                  subject: true
                }
              }
            }
          },
          difficulty: true
        }
      });
      res.status(201).json(question);
    } catch (error) {
      next(error);
    }
});

// Update question
router.put('/:id',
  authenticate,
  authorize([UserRole.ADMIN, UserRole.TUTOR]),
  validateRequest(QuestionSchema),
  async (req, res, next) => {
    try {
      const question = await prisma.question.update({
        where: { id: req.params.id },
        data: {
          ...req.body,
          options: JSON.stringify(req.body.options)
        },
        include: {
          subtopic: {
            include: {
              topic: {
                include: {
                  subject: true
                }
              }
            }
          },
          difficulty: true
        }
      });
      res.json(question);
    } catch (error) {
      next(error);
    }
});

// Delete question
router.delete('/:id',
  authenticate,
  authorize([UserRole.ADMIN]),
  async (req, res, next) => {
    try {
      await prisma.question.delete({
        where: { id: req.params.id }
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
});

export { router as questionsRouter };