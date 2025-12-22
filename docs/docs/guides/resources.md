---
sidebar_position: 2
---

# Resources

Resources expose data that AI assistants can read. They're identified by URIs and can contain text or binary content.

## Basic Resource

Use the `@Resource` decorator with a URI pattern:

```typescript
import { MCPServer, Resource } from '@mcpkit-dev/core';

@MCPServer({ name: 'docs-server', version: '1.0.0' })
class DocsServer {
  @Resource('docs://readme')
  async getReadme() {
    return {
      contents: [{
        uri: 'docs://readme',
        mimeType: 'text/markdown',
        text: '# Welcome to Our API\n\nThis is the documentation.',
      }],
    };
  }
}
```

## Resource with Options

```typescript
@Resource({
  // Required: Resource URI
  uri: 'config://settings',

  // Optional: Human-readable name
  name: 'Application Settings',

  // Optional: Description for AI
  description: 'Current application configuration',

  // Optional: MIME type
  mimeType: 'application/json',
})
async getSettings() {
  return {
    contents: [{
      uri: 'config://settings',
      text: JSON.stringify({ theme: 'dark', language: 'en' }),
    }],
  };
}
```

## URI Templates

Resources can use URI templates with parameters:

```typescript
@Resource('users://{userId}/profile')
async getUserProfile(userId: string) {
  const user = await db.users.findById(userId);

  return {
    contents: [{
      uri: `users://${userId}/profile`,
      mimeType: 'application/json',
      text: JSON.stringify(user),
    }],
  };
}
```

Multiple parameters:

```typescript
@Resource('repos://{owner}/{repo}/readme')
async getRepoReadme(owner: string, repo: string) {
  const readme = await github.getReadme(owner, repo);

  return {
    contents: [{
      uri: `repos://${owner}/${repo}/readme`,
      mimeType: 'text/markdown',
      text: readme,
    }],
  };
}
```

## Resource Types

### Text Resources

```typescript
@Resource('logs://latest')
async getLatestLogs() {
  const logs = await readLogFile();

  return {
    contents: [{
      uri: 'logs://latest',
      mimeType: 'text/plain',
      text: logs,
    }],
  };
}
```

### JSON Resources

```typescript
@Resource('api://status')
async getApiStatus() {
  const status = await checkApiHealth();

  return {
    contents: [{
      uri: 'api://status',
      mimeType: 'application/json',
      text: JSON.stringify(status, null, 2),
    }],
  };
}
```

### Binary Resources

```typescript
@Resource('images://{id}')
async getImage(id: string) {
  const image = await fetchImage(id);

  return {
    contents: [{
      uri: `images://${id}`,
      mimeType: 'image/png',
      blob: image.buffer.toString('base64'),
    }],
  };
}
```

## Multiple Contents

A single resource can return multiple content items:

```typescript
@Resource('bundle://all-configs')
async getAllConfigs() {
  const configs = await loadAllConfigs();

  return {
    contents: configs.map((config) => ({
      uri: `bundle://all-configs/${config.name}`,
      mimeType: 'application/json',
      text: JSON.stringify(config.data),
    })),
  };
}
```

## Dynamic Resource Lists

Resources can be discovered dynamically:

```typescript
@MCPServer({
  name: 'file-server',
  version: '1.0.0',
})
class FileServer {
  // List available resources
  async listResources() {
    const files = await fs.readdir('./data');
    return files.map((file) => ({
      uri: `file://data/${file}`,
      name: file,
      mimeType: 'text/plain',
    }));
  }

  // Read individual resources
  @Resource('file://data/{filename}')
  async getFile(filename: string) {
    const content = await fs.readFile(`./data/${filename}`, 'utf-8');

    return {
      contents: [{
        uri: `file://data/${filename}`,
        mimeType: 'text/plain',
        text: content,
      }],
    };
  }
}
```

## Protected Resources

Use `@RequireAuth` to protect resources:

```typescript
import { RequireAuth } from '@mcpkit-dev/core';

@Resource('secrets://api-keys')
@RequireAuth({ roles: ['admin'] })
async getApiKeys() {
  return {
    contents: [{
      uri: 'secrets://api-keys',
      mimeType: 'application/json',
      text: JSON.stringify(await vault.getApiKeys()),
    }],
  };
}
```

## Error Handling

```typescript
@Resource('users://{userId}/data')
async getUserData(userId: string) {
  const user = await db.users.findById(userId);

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  return {
    contents: [{
      uri: `users://${userId}/data`,
      mimeType: 'application/json',
      text: JSON.stringify(user),
    }],
  };
}
```
