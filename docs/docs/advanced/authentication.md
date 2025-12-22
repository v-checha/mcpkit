---
sidebar_position: 2
---

# Authentication

MCPKit provides built-in authentication middleware for HTTP transports.

## API Key Authentication

```typescript
import { apiKeyAuth } from '@mcpkit-dev/core';

@MCPServer({
  name: 'api-server',
  version: '1.0.0',
  middleware: [
    apiKeyAuth({
      header: 'X-API-Key',
      validate: async (key) => {
        const user = await db.findUserByApiKey(key);
        return user ? { userId: user.id, roles: user.roles } : null;
      },
    }),
  ],
})
class ApiServer {}
```

## JWT Authentication

```typescript
import { jwtAuth, createJwt } from '@mcpkit-dev/core';

// Create a JWT
const token = createJwt(
  { userId: '123', roles: ['admin'] },
  process.env.JWT_SECRET!,
  { expiresIn: '1h' }
);

// Validate JWTs
@MCPServer({
  name: 'jwt-server',
  version: '1.0.0',
  middleware: [
    jwtAuth({
      secret: process.env.JWT_SECRET!,
      issuer: 'my-app',
      algorithms: ['HS256'],
    }),
  ],
})
class JwtServer {}
```

## Bearer Token (OAuth)

```typescript
import { bearerAuth } from '@mcpkit-dev/core';

@MCPServer({
  name: 'oauth-server',
  version: '1.0.0',
  middleware: [
    bearerAuth({
      validate: async (token) => {
        const result = await oauthServer.introspect(token);
        return {
          valid: result.active,
          principal: { userId: result.sub },
          roles: result.scope?.split(' '),
        };
      },
    }),
  ],
})
class OAuthServer {}
```

## @RequireAuth Decorator

Protect individual tools and resources:

```typescript
import { RequireAuth } from '@mcpkit-dev/core';

@Tool({ description: 'Admin operation' })
@RequireAuth({ roles: ['admin'] })
async adminTool(@Param({ name: 'data' }) data: string) {
  return 'Admin only';
}

@Tool({ description: 'Premium feature' })
@RequireAuth({
  validate: (auth) => auth.claims?.subscription === 'premium',
  message: 'Premium subscription required',
})
async premiumTool(@Param({ name: 'data' }) data: string) {
  return 'Premium content';
}
```
