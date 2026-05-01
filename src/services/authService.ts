import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { createError } from '../middleware/errorHandler';

interface LoginResult {
  token: string;
  user: Partial<IUser>;
}

export const registerUser = async (
  name: string,
  email: string,
  password: string
): Promise<LoginResult> => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw createError('Email already registered', 409);
  }

  const user = await User.create({ name, email, password, role: 'admin' });
  const token = generateToken(String(user._id));

  return {
    token,
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
};

export const loginUser = async (
  email: string,
  password: string
): Promise<LoginResult> => {
  const user = await User.findOne({ email, isActive: true }).select('+password');
  if (!user) {
    throw createError('Invalid credentials', 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw createError('Invalid credentials', 401);
  }

  const token = generateToken(String(user._id));

  return {
    token,
    user: {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
};

export const generateToken = (id: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');

  return jwt.sign({ id }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};
