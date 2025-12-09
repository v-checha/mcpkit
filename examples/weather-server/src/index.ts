/**
 * Weather Server Example
 *
 * This example demonstrates how to build an MCP server using mcpkit decorators.
 * It provides weather-related tools, resources, and prompts.
 *
 * To run with Claude Desktop, add this to your Claude config:
 * {
 *   "mcpServers": {
 *     "weather": {
 *       "command": "node",
 *       "args": ["/path/to/examples/weather-server/dist/index.js"]
 *     }
 *   }
 * }
 */
import 'reflect-metadata';
import { MCPServer, Param, Prompt, Resource, Tool } from '@mcpkit/core';
import { z } from 'zod';

// Type definitions for weather data
interface WeatherData {
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
  location: string;
}

interface ForecastDay {
  date: string;
  high: number;
  low: number;
  conditions: string;
}

// Mock weather data store
const weatherDatabase: Record<string, WeatherData> = {
  'new york': {
    temperature: 22,
    conditions: 'sunny',
    humidity: 45,
    windSpeed: 12,
    location: 'New York, NY',
  },
  london: {
    temperature: 15,
    conditions: 'cloudy',
    humidity: 78,
    windSpeed: 8,
    location: 'London, UK',
  },
  tokyo: {
    temperature: 28,
    conditions: 'partly cloudy',
    humidity: 65,
    windSpeed: 5,
    location: 'Tokyo, Japan',
  },
  sydney: {
    temperature: 25,
    conditions: 'sunny',
    humidity: 55,
    windSpeed: 15,
    location: 'Sydney, Australia',
  },
  paris: {
    temperature: 18,
    conditions: 'rainy',
    humidity: 85,
    windSpeed: 10,
    location: 'Paris, France',
  },
};

/**
 * Weather Server MCP Implementation
 *
 * Demonstrates:
 * - @Tool with @Param decorators
 * - @Tool with explicit Zod schema
 * - @Resource for data access
 * - @Prompt for prompt templates
 */
@MCPServer({
  name: 'weather-server',
  version: '1.0.0',
  description: 'Get weather information for cities around the world',
})
class WeatherServer {
  /**
   * Get current weather for a city
   *
   * Uses @Param decorators to define individual parameters
   */
  @Tool({
    description: 'Get current weather conditions for a specified city',
    annotations: {
      readOnlyHint: true,
    },
  })
  async getWeather(
    @Param({ name: 'city', description: 'City name (e.g., "London", "Tokyo")' })
    city: string,
    @Param({
      name: 'unit',
      description: 'Temperature unit',
      optional: true,
      schema: z.enum(['celsius', 'fahrenheit']).default('celsius'),
    })
    unit?: 'celsius' | 'fahrenheit',
  ): Promise<WeatherData> {
    const normalizedCity = city.toLowerCase();
    const weather = weatherDatabase[normalizedCity];

    if (!weather) {
      throw new Error(
        `Weather data not available for "${city}". Available cities: ${Object.keys(weatherDatabase).join(', ')}`,
      );
    }

    // Convert temperature if needed
    if (unit === 'fahrenheit') {
      return {
        ...weather,
        temperature: Math.round((weather.temperature * 9) / 5 + 32),
      };
    }

    return weather;
  }

  /**
   * Get weather forecast using explicit Zod schema
   *
   * Demonstrates alternative approach with full schema definition
   */
  @Tool({
    description: 'Get weather forecast for upcoming days',
    schema: z.object({
      city: z.string().describe('City name'),
      days: z.number().min(1).max(7).default(3).describe('Number of days (1-7)'),
    }),
    annotations: {
      readOnlyHint: true,
    },
  })
  async getForecast(args: {
    city: string;
    days: number;
  }): Promise<{ city: string; forecast: ForecastDay[] }> {
    const normalizedCity = args.city.toLowerCase();
    const weather = weatherDatabase[normalizedCity];

    if (!weather) {
      throw new Error(`Weather data not available for "${args.city}"`);
    }

    // Generate mock forecast data
    const forecast: ForecastDay[] = [];
    const baseDate = new Date();

    for (let i = 0; i < args.days; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);

      const conditions = ['sunny', 'cloudy', 'partly cloudy', 'rainy'];
      forecast.push({
        date: date.toISOString().split('T')[0] ?? '',
        high: weather.temperature + Math.floor(Math.random() * 5),
        low: weather.temperature - Math.floor(Math.random() * 5),
        conditions: conditions[Math.floor(Math.random() * 4)] ?? 'sunny',
      });
    }

    return {
      city: weather.location,
      forecast,
    };
  }

  /**
   * List available cities
   *
   * Tool with no parameters
   */
  @Tool({
    description: 'List all cities with available weather data',
    annotations: {
      readOnlyHint: true,
    },
  })
  async listCities(): Promise<string[]> {
    return Object.values(weatherDatabase).map((w) => w.location);
  }

  /**
   * Resource: Get weather data as a resource
   *
   * Demonstrates URI template with parameter
   */
  @Resource('weather://cities/{city}/current')
  async getCityWeatherResource(city: string) {
    const normalizedCity = city.toLowerCase();
    const weather = weatherDatabase[normalizedCity];

    if (!weather) {
      return {
        contents: [
          {
            uri: `weather://cities/${city}/current`,
            mimeType: 'application/json',
            text: JSON.stringify({ error: `City "${city}" not found` }),
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri: `weather://cities/${city}/current`,
          mimeType: 'application/json',
          text: JSON.stringify(weather, null, 2),
        },
      ],
    };
  }

  /**
   * Resource: Static list of all cities
   */
  @Resource({
    uri: 'weather://cities',
    name: 'City List',
    description: 'List of all available cities',
    mimeType: 'application/json',
  })
  async getCitiesResource() {
    return {
      contents: [
        {
          uri: 'weather://cities',
          mimeType: 'application/json',
          text: JSON.stringify(
            Object.values(weatherDatabase).map((w) => w.location),
            null,
            2,
          ),
        },
      ],
    };
  }

  /**
   * Prompt: Generate a weather report prompt
   *
   * Demonstrates prompt with parameters
   */
  @Prompt({
    description: 'Generate a weather report for a city',
  })
  async weatherReport(
    @Param({ name: 'city', description: 'City to report on' })
    city: string,
  ) {
    const normalizedCity = city.toLowerCase();
    const weather = weatherDatabase[normalizedCity];

    if (!weather) {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please provide a weather report for ${city}, but note that we don't have data for this city.`,
            },
          },
        ],
      };
    }

    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Please write a friendly weather report for ${weather.location}.
Current conditions:
- Temperature: ${weather.temperature}°C
- Conditions: ${weather.conditions}
- Humidity: ${weather.humidity}%
- Wind Speed: ${weather.windSpeed} km/h

Make it conversational and include suggestions for activities based on the weather.`,
          },
        },
      ],
    };
  }

  /**
   * Prompt: Travel weather comparison
   */
  @Prompt({
    description: 'Compare weather between two cities for travel planning',
  })
  async travelComparison(
    @Param({ name: 'origin', description: 'Origin city' })
    origin: string,
    @Param({ name: 'destination', description: 'Destination city' })
    destination: string,
  ) {
    const originWeather = weatherDatabase[origin.toLowerCase()];
    const destWeather = weatherDatabase[destination.toLowerCase()];

    let text = `Please help me compare the weather between ${origin} and ${destination} for travel planning.\n\n`;

    if (originWeather) {
      text += `${origin} current weather:\n`;
      text += `- Temperature: ${originWeather.temperature}°C\n`;
      text += `- Conditions: ${originWeather.conditions}\n\n`;
    } else {
      text += `Note: Weather data not available for ${origin}\n\n`;
    }

    if (destWeather) {
      text += `${destination} current weather:\n`;
      text += `- Temperature: ${destWeather.temperature}°C\n`;
      text += `- Conditions: ${destWeather.conditions}\n\n`;
    } else {
      text += `Note: Weather data not available for ${destination}\n\n`;
    }

    text += 'Please provide packing suggestions and any weather-related travel tips.';

    return {
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text,
          },
        },
      ],
    };
  }
}

// Create and start the server
// Note: @MCPServer decorator adds listen(), close(), and isConnected() methods
const server = new WeatherServer() as WeatherServer & {
  listen(): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;
};

server
  .listen()
  .then(() => {
    console.error('Weather server started on stdio transport');
  })
  .catch((error: Error) => {
    console.error('Failed to start weather server:', error);
    process.exit(1);
  });

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down weather server...');
  await server.close();
  process.exit(0);
});
