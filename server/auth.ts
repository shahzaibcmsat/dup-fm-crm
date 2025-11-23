import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { User } from '@shared/schema';

// Configure passport local strategy
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      // Find user by username
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      const user = userResult[0];

      if (!user) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      // Check if user is active
      if (!user.isActive) {
        return done(null, false, { message: 'Account is deactivated' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);

      if (!isValidPassword) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      // Return user without password hash
      const { passwordHash, ...userWithoutPassword } = user;
      return done(null, userWithoutPassword);
    } catch (error) {
      return done(error);
    }
  })
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    const user = userResult[0];

    if (!user) {
      return done(null, false);
    }

    // Return user without password hash
    const { passwordHash, ...userWithoutPassword } = user;
    done(null, userWithoutPassword);
  } catch (error) {
    done(error);
  }
});

// Middleware to check if user is authenticated
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized - Please log in' });
}

// Middleware to check if user is admin
export function isAdmin(req: any, res: any, next: any) {
  if (req.isAuthenticated() && req.user?.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Forbidden - Admin access required' });
}

// Helper function to hash passwords
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// Helper function to create a new user
export async function createUser(username: string, email: string, password: string, role: 'admin' | 'user' = 'user') {
  const passwordHash = await hashPassword(password);
  
  const result = await db
    .insert(users)
    .values({
      username,
      email,
      passwordHash,
      role,
      isActive: true,
    })
    .returning();

  const { passwordHash: _, ...userWithoutPassword } = result[0];
  return userWithoutPassword;
}

export default passport;
