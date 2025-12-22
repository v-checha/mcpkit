/**
 * Tests for @RequireAuth decorator
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  RequireAuth,
  AuthorizationError,
  createAuthContext,
  unauthenticatedContext,
  withAuthContext,
  getRequireAuthOptions,
  getRequireAuthMetadata,
  isAuthRequired,
  setAuthContext,
  getAuthContext,
} from './require-auth.js';

describe('RequireAuth', () => {
  beforeEach(() => {
    // Clear auth context before each test
    setAuthContext(undefined);
  });

  afterEach(() => {
    setAuthContext(undefined);
  });

  describe('decorator behavior', () => {
    it('should throw when not authenticated', async () => {
      class TestClass {
        @RequireAuth()
        async protectedMethod() {
          return 'success';
        }
      }

      const instance = new TestClass();
      await expect(instance.protectedMethod()).rejects.toThrow(AuthorizationError);
    });

    it('should allow access when authenticated', async () => {
      class TestClass {
        @RequireAuth()
        async protectedMethod() {
          return 'success';
        }
      }

      const instance = new TestClass();

      const result = await withAuthContext(
        createAuthContext({ userId: '123' }),
        () => instance.protectedMethod(),
      );

      expect(result).toBe('success');
    });

    it('should check roles', async () => {
      class TestClass {
        @RequireAuth({ roles: ['admin'] })
        async adminMethod() {
          return 'admin only';
        }
      }

      const instance = new TestClass();

      // Should fail without admin role
      await expect(
        withAuthContext(
          createAuthContext({ userId: '123' }, { roles: ['user'] }),
          () => instance.adminMethod(),
        ),
      ).rejects.toThrow(AuthorizationError);

      // Should succeed with admin role
      const result = await withAuthContext(
        createAuthContext({ userId: '123' }, { roles: ['admin'] }),
        () => instance.adminMethod(),
      );
      expect(result).toBe('admin only');
    });

    it('should check claims', async () => {
      class TestClass {
        @RequireAuth({ claims: { subscription: 'premium' } })
        async premiumMethod() {
          return 'premium content';
        }
      }

      const instance = new TestClass();

      // Should fail without correct claim
      await expect(
        withAuthContext(
          createAuthContext({ userId: '123' }, { claims: { subscription: 'free' } }),
          () => instance.premiumMethod(),
        ),
      ).rejects.toThrow(AuthorizationError);

      // Should succeed with correct claim
      const result = await withAuthContext(
        createAuthContext({ userId: '123' }, { claims: { subscription: 'premium' } }),
        () => instance.premiumMethod(),
      );
      expect(result).toBe('premium content');
    });

    it('should use custom validation', async () => {
      class TestClass {
        @RequireAuth({
          validate: (auth) => auth.principal === 'special-user',
        })
        async specialMethod() {
          return 'special';
        }
      }

      const instance = new TestClass();

      // Should fail custom validation
      await expect(
        withAuthContext(
          createAuthContext('regular-user'),
          () => instance.specialMethod(),
        ),
      ).rejects.toThrow(AuthorizationError);

      // Should pass custom validation
      const result = await withAuthContext(
        createAuthContext('special-user'),
        () => instance.specialMethod(),
      );
      expect(result).toBe('special');
    });

    it('should use custom error message', async () => {
      class TestClass {
        @RequireAuth({ message: 'Custom auth error' })
        async customErrorMethod() {
          return 'success';
        }
      }

      const instance = new TestClass();

      try {
        await instance.customErrorMethod();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthorizationError);
        expect((error as AuthorizationError).message).toBe('Custom auth error');
      }
    });
  });

  describe('AuthorizationError', () => {
    it('should have correct code for unauthenticated', () => {
      const error = new AuthorizationError('Not logged in', 'UNAUTHENTICATED');
      expect(error.code).toBe('UNAUTHENTICATED');
      expect(error.name).toBe('AuthorizationError');
    });

    it('should have correct code for unauthorized', () => {
      const error = new AuthorizationError('No access', 'UNAUTHORIZED');
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('metadata utilities', () => {
    it('should get require auth options', () => {
      class TestClass {
        @RequireAuth({ roles: ['admin'] })
        adminMethod() {}
      }

      const options = getRequireAuthOptions(
        TestClass.prototype,
        'adminMethod',
      );
      expect(options).toBeDefined();
      expect(options?.roles).toEqual(['admin']);
    });

    it('should get all require auth metadata', () => {
      class TestClass {
        @RequireAuth({ roles: ['admin'] })
        adminMethod() {}

        @RequireAuth({ roles: ['user'] })
        userMethod() {}

        unprotectedMethod() {}
      }

      const metadata = getRequireAuthMetadata(TestClass.prototype);
      expect(metadata).toHaveLength(2);
    });

    it('should check if auth is required', () => {
      class TestClass {
        @RequireAuth()
        protectedMethod() {}

        unprotectedMethod() {}
      }

      expect(isAuthRequired(TestClass.prototype, 'protectedMethod')).toBe(true);
      expect(isAuthRequired(TestClass.prototype, 'unprotectedMethod')).toBe(false);
    });
  });

  describe('auth context utilities', () => {
    it('should create auth context', () => {
      const ctx = createAuthContext(
        { userId: '123' },
        { roles: ['admin'], claims: { org: 'acme' } },
      );

      expect(ctx.authenticated).toBe(true);
      expect(ctx.principal).toEqual({ userId: '123' });
      expect(ctx.roles).toEqual(['admin']);
      expect(ctx.claims).toEqual({ org: 'acme' });
    });

    it('should create unauthenticated context', () => {
      const ctx = unauthenticatedContext();
      expect(ctx.authenticated).toBe(false);
      expect(ctx.principal).toBeUndefined();
    });

    it('should set and get auth context', () => {
      const ctx = createAuthContext({ userId: '123' });
      setAuthContext(ctx);
      expect(getAuthContext()).toBe(ctx);

      setAuthContext(undefined);
      expect(getAuthContext()).toBeUndefined();
    });

    it('should nest withAuthContext calls', async () => {
      const outerCtx = createAuthContext({ userId: 'outer' });
      const innerCtx = createAuthContext({ userId: 'inner' });

      await withAuthContext(outerCtx, async () => {
        expect(getAuthContext()?.principal).toEqual({ userId: 'outer' });

        await withAuthContext(innerCtx, async () => {
          expect(getAuthContext()?.principal).toEqual({ userId: 'inner' });
        });

        // Should restore outer context
        expect(getAuthContext()?.principal).toEqual({ userId: 'outer' });
      });
    });
  });

  describe('role matching', () => {
    it('should match any role from list', async () => {
      class TestClass {
        @RequireAuth({ roles: ['admin', 'moderator', 'editor'] })
        staffMethod() {
          return 'staff';
        }
      }

      const instance = new TestClass();

      // Any of the roles should work
      for (const role of ['admin', 'moderator', 'editor']) {
        const result = await withAuthContext(
          createAuthContext({ userId: '123' }, { roles: [role] }),
          () => instance.staffMethod(),
        );
        expect(result).toBe('staff');
      }
    });

    it('should fail if no roles match', async () => {
      class TestClass {
        @RequireAuth({ roles: ['admin', 'moderator'] })
        staffMethod() {
          return 'staff';
        }
      }

      const instance = new TestClass();

      await expect(
        withAuthContext(
          createAuthContext({ userId: '123' }, { roles: ['guest'] }),
          () => instance.staffMethod(),
        ),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('async validation', () => {
    it('should support async custom validation', async () => {
      const validateAsync = vi.fn().mockImplementation(async (auth) => {
        // Simulate async validation (e.g., database lookup)
        await new Promise((r) => setTimeout(r, 10));
        return auth.claims?.approved === true;
      });

      class TestClass {
        @RequireAuth({ validate: validateAsync })
        async approvedMethod() {
          return 'approved';
        }
      }

      const instance = new TestClass();

      // Should fail async validation
      await expect(
        withAuthContext(
          createAuthContext({ userId: '123' }, { claims: { approved: false } }),
          () => instance.approvedMethod(),
        ),
      ).rejects.toThrow(AuthorizationError);

      // Should pass async validation
      const result = await withAuthContext(
        createAuthContext({ userId: '123' }, { claims: { approved: true } }),
        () => instance.approvedMethod(),
      );
      expect(result).toBe('approved');
      expect(validateAsync).toHaveBeenCalled();
    });
  });
});
