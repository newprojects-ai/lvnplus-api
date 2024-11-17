import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { UserRole } from '@prisma/client';
import { AuthRequest } from '../types/auth';
import { Response, NextFunction } from 'express';

const router = Router();

const TestConfigurationSchema = z.object({
  name: z.string().min(1).max(100),
  topicIds: z.array(z.string().uuid()),
  subtopicIds: z.array(z.string().uuid()),
  difficultyLevels: z.array(z.number().min(0).max(5)),
  questionCount: z.number().min(1).max(100),
  timeLimit: z.number().min(5).max(180)
});

// Get all test configurations
router.get('/configurations', 
  authenticate as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const configurations = await prisma.practiceTestConfiguration.findMany({
        include: {
          generatedTests: true
        }
      });
      res.json(configurations);
    } catch (error) {
      next(error);
    }
});

// Create test configuration
router.post('/configurations',
  authenticate as any,
  authorize([UserRole.ADMIN, UserRole.TUTOR]) as any,
  validateRequest(TestConfigurationSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const configuration = await prisma.practiceTestConfiguration.create({
        data: {
          ...req.body,
          topicIds: JSON.stringify(req.body.topicIds),
          subtopicIds: JSON.stringify(req.body.subtopicIds),
          difficultyLevels: JSON.stringify(req.body.difficultyLevels)
        },
        include: {
          generatedTests: true
        }
      });
      res.status(201).json(configuration);
    } catch (error) {
      next(error);
    }
});

// Generate new test from configuration
router.post('/generate/:configId', 
  authenticate as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const config = await prisma.practiceTestConfiguration.findUnique({
        where: { id: req.params.configId }
      });

      if (!config) {
        return res.status(404).json({ error: 'Configuration not found' });
      }

      const subtopicIds = JSON.parse(config.subtopicIds as string);
      const difficultyLevels = JSON.parse(config.difficultyLevels as string);

      // Get random questions based on configuration
      const questions = await prisma.question.findMany({
        where: {
          AND: [
            { subtopicId: { in: subtopicIds } },
            { difficulty: { level: { in: difficultyLevels } } }
          ]
        },
        take: config.questionCount,
        orderBy: { createdAt: 'desc' }
      });

      if (questions.length < config.questionCount) {
        return res.status(400).json({
          error: 'Not enough questions available for the requested configuration'
        });
      }

      // Create generated test
      const generatedTest = await prisma.generatedPracticeTest.create({
        data: {
          configurationId: config.id,
          questions: JSON.stringify(questions.map(q => q.id))
        },
        include: {
          configuration: true
        }
      });

      res.status(201).json({
        ...generatedTest,
        questions
      });
    } catch (error) {
      next(error);
    }
});

// Get test details
router.get('/test/:testId', 
  authenticate as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const test = await prisma.generatedPracticeTest.findUnique({
        where: { id: req.params.testId },
        include: {
          configuration: true
        }
      });

      if (!test) {
        return res.status(404).json({ error: 'Test not found' });
      }

      const questionIds = JSON.parse(test.questions as string);
      const questions = await prisma.question.findMany({
        where: { id: { in: questionIds } }
      });

      res.json({
        ...test,
        questions
      });
    } catch (error) {
      next(error);
    }
});

// Submit test attempt
router.post('/test/:testId/submit',
  authenticate as any,
  validateRequest(z.object({
    answers: z.record(z.string()),
    timeSpent: z.number().min(0)
  })),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { answers, timeSpent } = req.body;
      const test = await prisma.generatedPracticeTest.findUnique({
        where: { id: req.params.testId },
        include: {
          configuration: true
        }
      });

      if (!test) {
        return res.status(404).json({ error: 'Test not found' });
      }

      const questionIds = JSON.parse(test.questions as string);
      const questions = await prisma.question.findMany({
        where: { id: { in: questionIds } }
      });

      // Calculate score
      let score = 0;
      questions.forEach(question => {
        if (answers[question.id] === question.correctAnswer) {
          score++;
        }
      });

      // Create attempt record
      const attempt = await prisma.practiceTestAttempt.create({
        data: {
          userId: req.user!.id,
          testId: test.id,
          answers: JSON.stringify(answers),
          score,
          timeSpent,
          completedAt: new Date()
        },
        include: {
          user: true,
          test: {
            include: {
              configuration: true
            }
          }
        }
      });

      res.status(201).json(attempt);
    } catch (error) {
      next(error);
    }
});

// Get user's test attempts
router.get('/attempts', 
  authenticate as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const attempts = await prisma.practiceTestAttempt.findMany({
        where: { userId: req.user!.id },
        include: {
          test: {
            include: {
              configuration: true
            }
          }
        },
        orderBy: { completedAt: 'desc' }
      });

      res.json(attempts);
    } catch (error) {
      next(error);
    }
});

export { router as practiceTestsRouter };