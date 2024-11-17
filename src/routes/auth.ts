import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { users_role } from '@prisma/client';
import crypto from 'crypto'; // For generating UUIDs if needed

export const authRouter = Router();

// Schema for user registration
const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(users_role) // Matches the enum in Prisma schema
});

// Schema for user login
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Registration route
authRouter.post('/register', validateRequest(RegisterSchema), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if the user already exists
    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash the user's password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const user = await prisma.users.create({
      data: {
        user_id: crypto.randomUUID(), // Only needed if @default(uuid()) is not set in schema
        name,
        email,
        password: hashedPassword,
        role
      },
      select: {
        user_id: true,
        name: true,
        email: true,
        role: true
      }
    });

    // Generate a JWT token
    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
});

// Login route
authRouter.post('/login', validateRequest(LoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Validate the user's password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.json({
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    next(error);
  }
});
