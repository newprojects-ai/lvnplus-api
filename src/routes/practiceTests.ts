import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate, authorize } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/prisma';
import { users_role, type questions, Prisma, practice_test_configurations_test_type } from '@prisma/client';
import { AuthRequest } from '../types/auth';
import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

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
      const configurations = await prisma.practice_test_configurations.findMany({
        include: {
          generated_practice_tests: true
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
  authorize([users_role.Admin, users_role.Tutor]) as any,
  validateRequest(TestConfigurationSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const configuration = await prisma.practice_test_configurations.create({
        data: {
          config_id: randomUUID(),
          user_id: req.user!.id,
          test_type: practice_test_configurations_test_type.Mixed,
          is_timed: true,
          duration_minutes: req.body.timeLimit,
          question_count: req.body.questionCount
        },
        include: {
          generated_practice_tests: true
        }
      });

      // Create topic associations
      await Promise.all(req.body.topicIds.map((topicId: string) =>
        prisma.practice_test_topics.create({
          data: {
            config_id: configuration.config_id,
            topic_id: topicId,
            all_subtopics: true
          }
        })
      ));

      // Create subtopic associations
      await Promise.all(req.body.subtopicIds.map((subtopicId: string) =>
        prisma.practice_test_subtopics.create({
          data: {
            config_id: configuration.config_id,
            topic_id: req.body.topicIds[0], // Associate with first topic
            subtopic_id: subtopicId
          }
        })
      ));

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
      const config = await prisma.practice_test_configurations.findUnique({
        where: { config_id: req.params.configId },
        include: {
          practice_test_subtopics: true,
          practice_test_topics: true
        }
      });

      if (!config) {
        return res.status(404).json({ error: 'Configuration not found' });
      }

      const subtopicIds = config.practice_test_subtopics.map(pts => pts.subtopic_id);

      // Get random questions based on configuration
      const questions = await prisma.questions.findMany({
        where: {
          subtopic_id: { in: subtopicIds }
        },
        take: config.question_count || 10,
        orderBy: { created_at: 'desc' }
      });

      if (questions.length < (config.question_count || 10)) {
        return res.status(400).json({
          error: 'Not enough questions available for the requested configuration'
        });
      }

      // Create generated test
      const generatedTest = await prisma.generated_practice_tests.create({
        data: {
          generated_test_id: randomUUID(),
          config_id: config.config_id,
          user_id: req.user!.id,
          exam_id: null
        },
        include: {
          practice_test_configurations: true
        }
      });

      // Create practice test questions
      await Promise.all(questions.map((q, index) => 
        prisma.practice_test_questions.create({
          data: {
            test_question_id: randomUUID(),
            generated_test_id: generatedTest.generated_test_id,
            question_id: q.question_id,
            sequence_number: index + 1
          }
        })
      ));

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
      const test = await prisma.generated_practice_tests.findUnique({
        where: { generated_test_id: req.params.testId },
        include: {
          practice_test_configurations: true,
          practice_test_questions: {
            include: {
              questions: true
            }
          }
        }
      });

      if (!test) {
        return res.status(404).json({ error: 'Test not found' });
      }

      const questions = test.practice_test_questions.map(ptq => ptq.questions);

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
      const test = await prisma.generated_practice_tests.findUnique({
        where: { generated_test_id: req.params.testId },
        include: {
          practice_test_configurations: true,
          practice_test_questions: {
            include: {
              questions: true
            }
          }
        }
      });

      if (!test) {
        return res.status(404).json({ error: 'Test not found' });
      }

      const questions = test.practice_test_questions.map(ptq => ptq.questions);

      // Calculate score
      let score = 0;
      questions.forEach((question: questions | null) => {
        if (question && answers[question.question_id] === question.correct_answer) {
          score++;
        }
      });

      // Record the attempt in your application's storage
      // Since there's no practice_test_attempts table in the schema,
      // you might want to store this data elsewhere or create a new table

      res.status(201).json({
        testId: test.generated_test_id,
        score,
        timeSpent,
        totalQuestions: questions.length
      });
    } catch (error) {
      next(error);
    }
});

// Get user's test attempts
router.get('/attempts', 
  authenticate as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tests = await prisma.generated_practice_tests.findMany({
        where: { user_id: req.user!.id },
        include: {
          practice_test_configurations: true,
          practice_test_questions: {
            include: {
              questions: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      res.json(tests);
    } catch (error) {
      next(error);
    }
});

export { router as practiceTestsRouter };