import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import prisma from './db';
import bcrypt from 'bcrypt';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  
  // Session strategy: JWT (stateless)
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  
  // CSRF Protection (enabled by default in NextAuth.js)
  // NextAuth.js automatically generates and validates CSRF tokens
  // for all state-changing operations (sign in, sign out, etc.)
  // Requirement: 11.5
  useSecureCookies: process.env.NODE_ENV === 'production',
  
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax', // CSRF protection
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax', // CSRF protection
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  
  providers: [
    // Email/Password provider (will be implemented in Task 10.2)
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error('Invalid email or password');
        }

        // Check if email is verified
        if (!user.emailVerified) {
          throw new Error('Please verify your email before logging in');
        }

        // Check if password exists (OAuth users might not have password)
        if (!user.password) {
          throw new Error('Invalid email or password');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Invalid email or password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
        };
      },
    }),

    // Google OAuth provider (will be configured in Task 10.3)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      // Add user ID to token on sign in
      if (user) {
        token.id = user.id;
        token.emailVerified = user.emailVerified;
        token.lastRefresh = Date.now();
        console.log('JWT callback - Added user data to token:', {
          userId: user.id,
          emailVerified: user.emailVerified,
          timestamp: new Date().toISOString()
        });
      }
      
      // ALWAYS refresh user data from database to ensure we have the latest emailVerified status
      // This prevents race conditions where the token is created before database replication
      if (token.id) {
        const now = Date.now();
        const lastRefresh = (token.lastRefresh as number) || 0;
        
        // Refresh on:
        // 1. Update trigger (explicit refresh)
        // 2. First time (no lastRefresh set)
        // 3. Every 1 minute (to catch any updates)
        const shouldRefresh = trigger === 'update' || lastRefresh === 0 || (now - lastRefresh > 60 * 1000);
        
        if (shouldRefresh) {
          console.log('JWT callback - Refreshing user data from database for:', token.id, {
            reason: trigger === 'update' ? 'update trigger' : lastRefresh === 0 ? 'first time' : 'periodic refresh (1 min)',
            timeSinceLastRefresh: now - lastRefresh
          });
          
          // Fetch fresh user data from database
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { emailVerified: true, email: true, name: true }
          });
          
          if (dbUser) {
            token.emailVerified = dbUser.emailVerified;
            token.email = dbUser.email;
            token.name = dbUser.name;
            token.lastRefresh = now;
            console.log('JWT callback - Updated token with fresh data:', {
              emailVerified: token.emailVerified,
              email: token.email,
              timestamp: new Date().toISOString()
            });
          } else {
            console.warn('JWT callback - User not found in database:', token.id);
          }
        }
      }
      
      return token;
    },
    
    async session({ session, token }) {
      // Add user ID and emailVerified to session
      if (session.user) {
        session.user.id = token.id as string;
        session.user.emailVerified = token.emailVerified as Date | null;
        console.log('Session callback - Session created for user:', {
          userId: session.user.id,
          email: session.user.email,
          emailVerified: session.user.emailVerified
        });
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
    verifyRequest: '/verify-request',
  },

  // Enable debug in development
  debug: process.env.NODE_ENV === 'development',
};
