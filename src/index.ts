import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth';
import { examsRouter } from './routes/exams';
import { subjectsRouter } from './routes/subjects';
import { topicsRouter } from './routes/topics';
import { subtopicsRouter } from './routes/subtopics';
import { questionsRouter } from './routes/questions';
import { practiceTestsRouter } from './routes/practiceTests';
import { analyticsRouter } from './routes/analytics';
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