import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import prisma from '../config/prisma';
import { AuthRequest } from '../types/auth';
import { Response, NextFunction } from 'express';

const router = Router();

// Get overall performance stats for a student
router.get('/student/:studentId', 
  authenticate as any,
  authorize([UserRole.ADMIN, UserRole.TUTOR, UserRole.PARENT, UserRole.STUDENT]) as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;

      // Ensure users can only access their own data unless they're admin/tutor
      if (req.user?.role === UserRole.STUDENT && req.user?.id !== studentId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const attempts = await prisma.practiceTestAttempt.findMany({
        where: { userId: studentId },
        include: {
          test: {
            include: {
              configuration: true
            }
          }
        },
        orderBy: { completedAt: 'desc' }
      });

      // Calculate overall statistics
      const totalAttempts = attempts.length;
      const averageScore = attempts.reduce((acc, curr) => acc + curr.score, 0) / totalAttempts || 0;
      const averageTimeSpent = attempts.reduce((acc, curr) => acc + curr.timeSpent, 0) / totalAttempts || 0;

      // Calculate progress over time
      const progressByMonth = await prisma.$queryRaw`
        SELECT 
          DATE_FORMAT(completedAt, '%Y-%m') as month,
          AVG(score) as averageScore,
          COUNT(*) as attemptCount
        FROM PracticeTestAttempt
        WHERE userId = ${studentId}
        GROUP BY DATE_FORMAT(completedAt, '%Y-%m')
        ORDER BY month DESC
        LIMIT 12
      `;

      // Get performance by topic
      const topicPerformance = await prisma.$queryRaw`
        SELECT 
          t.name as topicName,
          AVG(pta.score) as averageScore,
          COUNT(*) as attemptCount
        FROM PracticeTestAttempt pta
        JOIN GeneratedPracticeTest gpt ON pta.testId = gpt.id
        JOIN PracticeTestConfiguration ptc ON gpt.configurationId = ptc.id
        JOIN Topic t ON t.id IN (SELECT value FROM JSON_TABLE(ptc.topicIds, '$[*]' COLUMNS (value VARCHAR(255) PATH '$')) as topics)
        WHERE pta.userId = ${studentId}
        GROUP BY t.id, t.name
      `;

      // Get performance by difficulty level
      const difficultyPerformance = await prisma.$queryRaw`
        SELECT 
          dl.level as difficultyLevel,
          AVG(pta.score) as averageScore,
          COUNT(*) as attemptCount
        FROM PracticeTestAttempt pta
        JOIN GeneratedPracticeTest gpt ON pta.testId = gpt.id
        JOIN PracticeTestConfiguration ptc ON gpt.configurationId = ptc.id
        JOIN DifficultyLevel dl ON dl.level IN (SELECT CAST(value AS SIGNED) FROM JSON_TABLE(ptc.difficultyLevels, '$[*]' COLUMNS (value VARCHAR(255) PATH '$')) as difficulties)
        WHERE pta.userId = ${studentId}
        GROUP BY dl.level
        ORDER BY dl.level
      `;

      res.json({
        overview: {
          totalAttempts,
          averageScore,
          averageTimeSpent,
          totalTestsCompleted: totalAttempts,
          lastTestDate: attempts[0]?.completedAt
        },
        progressByMonth,
        topicPerformance,
        difficultyPerformance,
        recentAttempts: attempts.slice(0, 5)
      });
    } catch (error) {
      next(error);
    }
});

// Get class/group performance (for tutors/admins)
router.get('/group/:groupId',
  authenticate as any,
  authorize([UserRole.ADMIN, UserRole.TUTOR]) as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const students = await prisma.user.findMany({
        where: { role: UserRole.STUDENT },
        include: {
          practiceTestAttempts: {
            include: {
              test: {
                include: {
                  configuration: true
                }
              }
            }
          }
        }
      });

      const groupStats = students.map(student => {
        const attempts = student.practiceTestAttempts;
        return {
          studentId: student.id,
          studentName: student.name,
          totalAttempts: attempts.length,
          averageScore: attempts.reduce((acc, curr) => acc + curr.score, 0) / attempts.length || 0,
          averageTimeSpent: attempts.reduce((acc, curr) => acc + curr.timeSpent, 0) / attempts.length || 0,
          lastTestDate: attempts[0]?.completedAt
        };
      });

      // Calculate group averages
      const groupAverages = {
        averageScore: groupStats.reduce((acc, curr) => acc + curr.averageScore, 0) / groupStats.length || 0,
        averageAttempts: groupStats.reduce((acc, curr) => acc + curr.totalAttempts, 0) / groupStats.length || 0,
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

// Get detailed topic analysis
router.get('/topics/:studentId',
  authenticate as any,
  authorize([UserRole.ADMIN, UserRole.TUTOR, UserRole.PARENT, UserRole.STUDENT]) as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;

      // Ensure users can only access their own data unless they're admin/tutor
      if (req.user?.role === UserRole.STUDENT && req.user?.id !== studentId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const topicAnalysis = await prisma.$queryRaw`
        SELECT 
          t.id as topicId,
          t.name as topicName,
          st.id as subtopicId,
          st.name as subtopicName,
          COUNT(DISTINCT pta.id) as attemptCount,
          AVG(pta.score) as averageScore,
          AVG(pta.timeSpent) as averageTimeSpent
        FROM Topic t
        JOIN Subtopic st ON st.topicId = t.id
        LEFT JOIN PracticeTestAttempt pta ON pta.userId = ${studentId}
        GROUP BY t.id, t.name, st.id, st.name
        ORDER BY t.name, st.name
      `;

      res.json(topicAnalysis);
    } catch (error) {
      next(error);
    }
});

// Get improvement suggestions
router.get('/suggestions/:studentId',
  authenticate as any,
  authorize([UserRole.ADMIN, UserRole.TUTOR, UserRole.PARENT, UserRole.STUDENT]) as any,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;

      // Get topics with low performance
      const weakTopics = await prisma.$queryRaw`
        SELECT 
          t.id as topicId,
          t.name as topicName,
          AVG(pta.score) as averageScore
        FROM Topic t
        JOIN Subtopic st ON st.topicId = t.id
        JOIN PracticeTestAttempt pta ON pta.userId = ${studentId}
        GROUP BY t.id, t.name
        HAVING averageScore < 0.6
        ORDER BY averageScore ASC
        LIMIT 3
      `;

      // Get recommended practice configurations
      const recommendations = await Promise.all(
        (weakTopics as any[]).map(async (topic) => {
          const config = await prisma.practiceTestConfiguration.create({
            data: {
              name: `Recommended Practice: ${topic.topicName}`,
              topicIds: JSON.stringify([topic.topicId]),
              subtopicIds: JSON.stringify([]), // Will be filled with all subtopics
              difficultyLevels: JSON.stringify([1, 2, 3]), // Start with easier questions
              questionCount: 10,
              timeLimit: 30
            }
          });

          return {
            topic: topic.topicName,
            averageScore: topic.averageScore,
            recommendedConfig: config
          };
        })
      );

      res.json({
        weakTopics,
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