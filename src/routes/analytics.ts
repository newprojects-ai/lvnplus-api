import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { users_role, type users, type Prisma, practice_test_configurations_test_type } from '@prisma/client';
import prisma from '../config/prisma';
import { AuthRequest } from '../types/auth';
import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

interface AttemptStats {
  score: number;
  timeSpent: number;
  completedAt: Date | null;
}

interface StudentStats {
  studentId: string;
  studentName: string;
  totalAttempts: number;
  averageScore: number;
  averageTimeSpent: number;
  lastTestDate: Date | null;
}

// Get overall performance stats for a student
router.get('/student/:studentId', 
  authenticate as any,
  authorize([users_role.Admin, users_role.Tutor, users_role.Parent, users_role.Student]) as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;

      // Ensure users can only access their own data unless they're admin/tutor
      if (req.user?.role === users_role.Student && req.user?.id !== studentId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const tests = await prisma.generated_practice_tests.findMany({
        where: { user_id: studentId },
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

      // Calculate overall statistics
      const attempts = tests.map(test => {
        let score = 0;
        const questions = test.practice_test_questions.map(ptq => ptq.questions);
        questions.forEach(q => {
          if (q) score++;
        });
        
        return {
          score: score / questions.length,
          timeSpent: test.practice_test_configurations?.duration_minutes || 0,
          completedAt: test.created_at
        } as AttemptStats;
      });

      const totalAttempts = attempts.length;
      const averageScore = attempts.reduce((acc: number, curr: AttemptStats) => acc + curr.score, 0) / totalAttempts || 0;
      const averageTimeSpent = attempts.reduce((acc: number, curr: AttemptStats) => acc + curr.timeSpent, 0) / totalAttempts || 0;

      // Get performance by topic
      const topicPerformance = await prisma.practice_test_topics.groupBy({
        by: ['topic_id'],
        where: {
          practice_test_configurations: {
            generated_practice_tests: {
              some: { user_id: studentId }
            }
          }
        },
        _count: {
          topic_id: true
        }
      });

      res.json({
        overview: {
          totalAttempts,
          averageScore,
          averageTimeSpent,
          lastTestDate: attempts[0]?.completedAt
        },
        topicPerformance,
        recentAttempts: tests.slice(0, 5)
      });
    } catch (error) {
      next(error);
    }
});

// Get class/group performance (for tutors/admins)
router.get('/group/:groupId',
  authenticate as any,
  authorize([users_role.Admin, users_role.Tutor]) as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const students = await prisma.users.findMany({
        where: { role: users_role.Student },
        include: {
          generated_practice_tests: {
            include: {
              practice_test_configurations: true,
              practice_test_questions: {
                include: {
                  questions: true
                }
              }
            }
          }
        }
      });

      const groupStats: StudentStats[] = students.map((student: users & { generated_practice_tests: any[] }) => {
        const attempts = student.generated_practice_tests;
        return {
          studentId: student.user_id,
          studentName: student.name,
          totalAttempts: attempts.length,
          averageScore: attempts.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0) / attempts.length || 0,
          averageTimeSpent: attempts.reduce((acc: number, curr: any) => acc + (curr.timeSpent || 0), 0) / attempts.length || 0,
          lastTestDate: attempts[0]?.created_at || null
        };
      });

      // Calculate group averages
      const groupAverages = {
        averageScore: groupStats.reduce((acc: number, curr: StudentStats) => acc + curr.averageScore, 0) / groupStats.length || 0,
        averageAttempts: groupStats.reduce((acc: number, curr: StudentStats) => acc + curr.totalAttempts, 0) / groupStats.length || 0,
        totalStudents: groupStats.length
      };

      res.json({
        groupAverages,
        studentStats: groupStats
      });
    } catch (error) {
      next(error);
    }
});

// Get improvement suggestions
router.get('/suggestions/:studentId',
  authenticate as any,
  authorize([users_role.Admin, users_role.Tutor, users_role.Parent, users_role.Student]) as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;

      // Get topics with low performance
      const weakTopics = await prisma.practice_test_topics.findMany({
        where: {
          practice_test_configurations: {
            generated_practice_tests: {
              some: { user_id: studentId }
            }
          },
          all_subtopics: true
        },
        include: {
          topics: true
        }
      });

      // Get recommended practice configurations
      const recommendations = await Promise.all(
        weakTopics.map(async (topic) => {
          const config = await prisma.practice_test_configurations.create({
            data: {
              config_id: randomUUID(),
              user_id: studentId,
              test_type: practice_test_configurations_test_type.Mixed,
              is_timed: true,
              duration_minutes: 30,
              question_count: 10,
              practice_test_topics: {
                create: {
                  topic_id: topic.topic_id,
                  all_subtopics: true
                }
              }
            }
          });

          return {
            topic: topic.topics.name,
            recommendedConfig: config
          };
        })
      );

      res.json({
        weakTopics: weakTopics.map(t => ({
          topicId: t.topic_id,
          topicName: t.topics.name
        })),
        recommendations,
        generalSuggestions: [
          'Focus on understanding core concepts before moving to advanced topics',
          'Practice regularly with timed tests',
          'Review incorrect answers thoroughly',
          'Gradually increase difficulty levels as you improve'
        ]
      });
    } catch (error) {
      next(error);
    }
});

export { router as analyticsRouter };