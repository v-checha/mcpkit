---
sidebar_position: 5
---

# Server Composition

Combine multiple MCP servers into a unified API.

```typescript
import { composeServers, createComposedServer } from '@mcpkit-dev/core';

// Define servers
@MCPServer({ name: 'weather', version: '1.0.0' })
class WeatherServer {
  @Tool({ description: 'Get weather' })
  async getWeather(@Param({ name: 'city' }) city: string) {
    return `Weather in ${city}`;
  }
}

@MCPServer({ name: 'news', version: '1.0.0' })
class NewsServer {
  @Tool({ description: 'Get news' })
  async getNews(@Param({ name: 'topic' }) topic: string) {
    return `News about ${topic}`;
  }
}

// Compose with prefixes
const ComposedServer = createComposedServer({
  name: 'combined-server',
  version: '1.0.0',
  servers: [
    { instance: new WeatherServer(), toolPrefix: 'weather_' },
    { instance: new NewsServer(), toolPrefix: 'news_' },
  ],
});

const server = new ComposedServer();
await server.listen();
// Tools: weather_getWeather, news_getNews
```
