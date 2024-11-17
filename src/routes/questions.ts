import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { users_role, type questions, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

const router = Router();

const QuestionSchema = z.object({
  questionText: z.string().min(1),
  options: z.array(z.string()).min(2),
  correctAnswer: z.string(),
  subtopicId: z.string().uuid(),
  difficultyId: z.number(),
  subjectId: z.string().uuid()
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

    const questions = await prisma.questions.findMany({
      where: {
        AND: [
          { difficulty_id: difficultyId },
          { subtopic_id: { in: subtopicIds } }
        ]
      },
      take: count,
      orderBy: {
        created_at: 'desc'
      }
    });

    // Shuffle the questions array
    const shuffledQuestions = [...questions]
      .map((q) => ({ q, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ q }) => q);

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
    const where: Prisma.questionsWhereInput = {};

    if (difficulty) {
      where.difficulty_id = parseInt(difficulty);
    }

    if (subtopicId) {
      where.subtopic_id = subtopicId;
    }

    if (topicId) {
      where.subtopics = { topic_id: topicId };
    }

    if (subjectId) {
      where.subject_id = subjectId;
    }

    if (search) {
      where.question_text = { contains: search };
    }

    // Get total count for pagination
    const total = await prisma.questions.count({ where });

    // Get questions
    const questions = await prisma.questions.findMany({
      where,
      include: {
        subtopics: {
          include: {
            topics: {
              include: {
                subjects: true
              }
            }
          }
        },
        difficulty_levels: true
      },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' }
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
    const question = await prisma.questions.findUnique({
      where: { question_id: req.params.id },
      include: {
        subtopics: {
          include: {
            topics: {
              include: {
                subjects: true
              }
            }
          }
        },
        difficulty_levels: true
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
  authorize([users_role.Admin, users_role.Tutor]),
  validateRequest(QuestionSchema),
  async (req, res, next) => {
    try {
      const questionId = randomUUID();
      const question = await prisma.questions.create({
        data: {
          question_id: questionId,
          question_text: req.body.questionText,
          options: JSON.stringify(req.body.options),
          correct_answer: req.body.correctAnswer,
          subtopic_id: req.body.subtopicId,
          difficulty_id: req.body.difficultyId,
          subject_id: req.body.subjectId,
          subjects: {
            connect: {
              subject_id: req.body.subjectId
            }
          }
        },
        include: {
          subtopics: {
            include: {
              topics: {
                include: {
                  subjects: true
                }
              }
            }
          },
          difficulty_levels: true
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
  authorize([users_role.Admin, users_role.Tutor]),
  validateRequest(QuestionSchema),
  async (req, res, next) => {
    try {
      const question = await prisma.questions.update({
        where: { question_id: req.params.id },
        data: {
          question_text: req.body.questionText,
          options: JSON.stringify(req.body.options),
          correct_answer: req.body.correctAnswer,
          subtopic_id: req.body.subtopicId,
          difficulty_id: req.body.difficultyId,
          subject_id: req.body.subjectId,
          subjects: {
            connect: {
              subject_id: req.body.subjectId
            }
          }
        },
        include: {
          subtopics: {
            include: {
              topics: {
                include: {
                  subjects: true
                }
              }
            }
          },
          difficulty_levels: true
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
  authorize([users_role.Admin]),
  async (req, res, next) => {
    try {
      await prisma.questions.delete({
        where: { question_id: req.params.id }
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
});

export { router as questionsRouter };