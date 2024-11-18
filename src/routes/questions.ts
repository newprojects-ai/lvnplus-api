import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { users_role, type questions, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Question:
 *       type: object
 *       properties:
 *         question_id:
 *           type: string
 *           format: uuid
 *         question_text:
 *           type: string
 *         options:
 *           type: array
 *           items:
 *             type: string
 *         correct_answer:
 *           type: string
 *         subtopic_id:
 *           type: string
 *           format: uuid
 *         difficulty_id:
 *           type: integer
 *         subject_id:
 *           type: string
 *           format: uuid
 *     QuestionRequest:
 *       type: object
 *       required:
 *         - questionText
 *         - options
 *         - correctAnswer
 *         - subtopicId
 *         - difficultyId
 *         - subjectId
 *       properties:
 *         questionText:
 *           type: string
 *         options:
 *           type: array
 *           items:
 *             type: string
 *         correctAnswer:
 *           type: string
 *         subtopicId:
 *           type: string
 *           format: uuid
 *         difficultyId:
 *           type: integer
 *         subjectId:
 *           type: string
 *           format: uuid
 */

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

/**
 * @swagger
 * /api/questions/random/practice:
 *   get:
 *     tags: [Questions]
 *     summary: Get random questions for practice
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: count
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: difficultyId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: subtopicIds
 *         schema:
 *           type: string
 *         description: Comma-separated list of subtopic IDs
 *     responses:
 *       200:
 *         description: List of random questions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Question'
 */
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

    const shuffledQuestions = [...questions]
      .map((q) => ({ q, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ q }) => q);

    res.json(shuffledQuestions.slice(0, count));
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/questions:
 *   get:
 *     tags: [Questions]
 *     summary: Get questions with pagination and filters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *       - in: query
 *         name: subtopicId
 *         schema:
 *           type: string
 *       - in: query
 *         name: topicId
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of questions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Question'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     limit:
 *                       type: integer
 */
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

    const total = await prisma.questions.count({ where });
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

/**
 * @swagger
 * /api/questions/{id}:
 *   get:
 *     tags: [Questions]
 *     summary: Get question by ID
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
 *         description: Question details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Question'
 *       404:
 *         description: Question not found
 */
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

/**
 * @swagger
 * /api/questions:
 *   post:
 *     tags: [Questions]
 *     summary: Create a new question
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuestionRequest'
 *     responses:
 *       201:
 *         description: Question created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Question'
 *       403:
 *         description: Insufficient permissions
 */
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

/**
 * @swagger
 * /api/questions/{id}:
 *   put:
 *     tags: [Questions]
 *     summary: Update a question
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
 *             $ref: '#/components/schemas/QuestionRequest'
 *     responses:
 *       200:
 *         description: Question updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Question'
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Question not found
 */
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

/**
 * @swagger
 * /api/questions/{id}:
 *   delete:
 *     tags: [Questions]
 *     summary: Delete a question
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
 *         description: Question deleted successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Question not found
 */
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