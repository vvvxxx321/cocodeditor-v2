import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth/verifyToken';

// Extend Request type to include the user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ message: 'Authorization header missing' });
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ message: 'Bearer token missing' });
    return;
  }

  try {
    const user = await verifyAccessToken(token);
    req.user = { id: user.id, email: user.email };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};
