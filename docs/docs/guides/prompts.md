---
sidebar_position: 3
---

# Prompts

Prompts are reusable message templates that can be invoked by AI assistants.

## Basic Prompt

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Prompt, Param } from '@mcpkit-dev/core';

@MCPServer({ name: 'writing-server', version: '1.0.0' })
class WritingServer {
  @Prompt({ description: 'Generate a blog post outline' })
  async blogOutline(
    @Param({ name: 'topic', description: 'Topic for the blog post' }) topic: string
  ) {
    return {
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Create a detailed outline for a blog post about: ${topic}`,
        },
      }],
    };
  }
}

const server = createServer(WritingServer);
await server.listen();
```

## Prompt Options

```typescript
@Prompt({
  // Required: Description shown to AI
  description: 'Generate marketing copy',

  // Optional: Custom prompt name
  name: 'marketing_copy',
})
async generateCopy(
  @Param({ name: 'product' }) product: string,
  @Param({ name: 'tone', optional: true }) tone: 'formal' | 'casual' = 'casual'
) {
  return {
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Write ${tone} marketing copy for: ${product}`,
      },
    }],
  };
}
```

## Multi-Message Prompts

```typescript
@Prompt({ description: 'Code review assistant' })
async codeReview(@Param({ name: 'code' }) code: string) {
  return {
    messages: [
      {
        role: 'system' as const,
        content: {
          type: 'text' as const,
          text: 'You are an expert code reviewer. Provide constructive feedback.',
        },
      },
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Please review this code:\n\n\`\`\`\n${code}\n\`\`\``,
        },
      },
    ],
  };
}
```

## Prompts with Multiple Content Types

```typescript
@Prompt({ description: 'Analyze image' })
async analyzeImage(
  @Param({ name: 'imageUrl' }) imageUrl: string,
  @Param({ name: 'question' }) question: string
) {
  return {
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'url',
            url: imageUrl,
          },
        },
        {
          type: 'text',
          text: question,
        },
      ],
    }],
  };
}
```
