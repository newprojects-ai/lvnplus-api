import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { router as authRouter } from './routes/auth';
import { router as examsRouter } from './routes/exams';
import { router as subjectsRouter } from './routes/subjects';
import { router as topicsRouter } from './routes/topics';
import { router as subtopicsRouter } from './routes/subtopics';
import { router as questionsRouter } from './routes/questions';
import { router as practiceTestsRouter } from './routes/practiceTests';
import { router as analyticsRouter } from './routes/analytics';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/exams', examsRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/subtopics', subtopicsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/practice-tests', practiceTestsRouter);
app.use('/api/analytics', analyticsRouter);

// Error handling
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});