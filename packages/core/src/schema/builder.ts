import { type ZodRawShape, type ZodTypeAny, z } from 'zod';
import { SchemaError } from '../errors/index.js';
import type { ParamMetadata, ToolMetadata } from '../metadata/index.js';

/**
 * Infer a Zod schema from TypeScript design-time type
 * Uses reflect-metadata types emitted by TypeScript compiler
 */
export function inferSchemaFromType(designType: unknown, description?: string): ZodTypeAny {
  let schema: ZodTypeAny;

  // Handle primitive types
  if (designType === String) {
    schema = z.string();
  } else if (designType === Number) {
    schema = z.number();
  } else if (designType === Boolean) {
    schema = z.boolean();
  } else if (designType === Array) {
    // Default to array of unknown - user should provide explicit schema
    schema = z.array(z.unknown());
  } else if (designType === Object) {
    // Default to record - user should provide explicit schema
    schema = z.record(z.unknown());
  } else {
    // Fallback to unknown for unrecognized types
    schema = z.unknown();
  }

  // Add description if provided
  if (description) {
    schema = schema.describe(description);
  }

  return schema;
}

/**
 * Build a Zod object schema from parameter metadata
 * Returns the shape that can be used with z.object()
 */
export function buildSchemaFromParams(params: ParamMetadata[]): ZodRawShape {
  const shape: ZodRawShape = {};

  // Sort by index to maintain parameter order
  const sortedParams = [...params]
    .filter((p): p is ParamMetadata => p !== undefined)
    .sort((a, b) => a.index - b.index);

  for (const param of sortedParams) {
    if (!param.name) {
      throw new SchemaError(
        `Parameter at index ${param.index} is missing a name. ` +
          `Use @Param({ name: 'paramName' }) to specify the parameter name.`,
      );
    }

    let schema: ZodTypeAny;

    if (param.schema) {
      // User provided explicit schema - use it directly
      schema = param.schema;
    } else {
      // Infer from design-time type
      schema = inferSchemaFromType(param.type, param.description);
    }

    // Apply optional modifier if needed
    if (param.optional) {
      schema = schema.optional();
    }

    shape[param.name] = schema;
  }

  return shape;
}

/**
 * Build complete input schema for a tool
 * Handles both explicit schema and @Param-based schema
 */
export function buildToolInputSchema(
  prototype: object,
  toolMeta: ToolMetadata,
  getParamsMetadata: (target: object, propertyKey: string | symbol) => ParamMetadata[],
): ZodRawShape | undefined {
  // If explicit schema provided, extract its shape
  if (toolMeta.schema) {
    // Check if it's a ZodObject
    if (toolMeta.schema instanceof z.ZodObject) {
      return toolMeta.schema.shape;
    }
    // For other Zod types, wrap in object with single 'args' key
    return { args: toolMeta.schema };
  }

  // Build from @Param decorators
  const params = getParamsMetadata(prototype, toolMeta.propertyKey);

  if (params.length === 0) {
    return undefined; // No parameters
  }

  return buildSchemaFromParams(params);
}

/**
 * Convert Zod schema shape to JSON Schema format
 * Used for MCP protocol communication
 */
export function zodShapeToJsonSchema(shape: ZodRawShape): {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
} {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, zodSchema] of Object.entries(shape)) {
    const jsonSchema = zodToJsonSchemaProperty(zodSchema);
    properties[key] = jsonSchema;

    // Check if required (not optional)
    if (!zodSchema.isOptional()) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required,
  };
}

/**
 * Convert a single Zod schema to JSON Schema property
 */
function zodToJsonSchemaProperty(schema: ZodTypeAny): unknown {
  const def = schema._def;
  const description = def.description;

  // Handle optional wrapper
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchemaProperty(schema.unwrap());
  }

  // Handle default wrapper
  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchemaProperty(def.innerType);
    return {
      ...(typeof inner === 'object' ? inner : {}),
      default: def.defaultValue(),
    };
  }

  // Handle primitive types
  if (schema instanceof z.ZodString) {
    return { type: 'string', ...(description && { description }) };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: 'number', ...(description && { description }) };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean', ...(description && { description }) };
  }

  // Handle enum
  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: def.values,
      ...(description && { description }),
    };
  }

  // Handle literal
  if (schema instanceof z.ZodLiteral) {
    const value = def.value;
    return {
      type: typeof value,
      const: value,
      ...(description && { description }),
    };
  }

  // Handle array
  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchemaProperty(def.type),
      ...(description && { description }),
    };
  }

  // Handle object
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchemaProperty(value as ZodTypeAny);
      if (!(value as ZodTypeAny).isOptional()) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
      ...(description && { description }),
    };
  }

  // Handle union
  if (schema instanceof z.ZodUnion) {
    return {
      anyOf: def.options.map((opt: ZodTypeAny) => zodToJsonSchemaProperty(opt)),
      ...(description && { description }),
    };
  }

  // Fallback for unknown types
  return { ...(description && { description }) };
}
