import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ParamMetadata } from '../metadata/index.js';
import { buildSchemaFromParams, inferSchemaFromType, zodShapeToJsonSchema } from './builder.js';

describe('Schema Builder', () => {
  describe('inferSchemaFromType', () => {
    it('should infer string schema from String', () => {
      const schema = inferSchemaFromType(String);
      expect(schema.parse('hello')).toBe('hello');
      expect(() => schema.parse(123)).toThrow();
    });

    it('should infer number schema from Number', () => {
      const schema = inferSchemaFromType(Number);
      expect(schema.parse(42)).toBe(42);
      expect(() => schema.parse('not a number')).toThrow();
    });

    it('should infer boolean schema from Boolean', () => {
      const schema = inferSchemaFromType(Boolean);
      expect(schema.parse(true)).toBe(true);
      expect(schema.parse(false)).toBe(false);
    });

    it('should add description when provided', () => {
      const schema = inferSchemaFromType(String, 'A city name');
      expect(schema.description).toBe('A city name');
    });

    it('should return unknown for unrecognized types', () => {
      class CustomClass {}
      const schema = inferSchemaFromType(CustomClass);
      // Should accept anything
      expect(schema.parse('anything')).toBe('anything');
      expect(schema.parse(123)).toBe(123);
    });
  });

  describe('buildSchemaFromParams', () => {
    it('should build schema from parameter metadata', () => {
      const params: ParamMetadata[] = [
        { index: 0, name: 'city', type: String },
        { index: 1, name: 'count', type: Number },
      ];

      const shape = buildSchemaFromParams(params);

      expect(shape.city).toBeDefined();
      expect(shape.count).toBeDefined();
    });

    it('should use explicit schema when provided', () => {
      const explicitSchema = z.enum(['celsius', 'fahrenheit']);
      const params: ParamMetadata[] = [{ index: 0, name: 'unit', schema: explicitSchema }];

      const shape = buildSchemaFromParams(params);

      expect(shape.unit).toBe(explicitSchema);
    });

    it('should mark optional parameters', () => {
      const params: ParamMetadata[] = [
        { index: 0, name: 'required', type: String },
        { index: 1, name: 'optional', type: String, optional: true },
      ];

      const shape = buildSchemaFromParams(params);
      const schema = z.object(shape);

      // Required should fail without value
      expect(() => schema.parse({ optional: 'value' })).toThrow();
      // Optional should pass without value
      expect(() => schema.parse({ required: 'value' })).not.toThrow();
    });

    it('should throw when parameter has no name', () => {
      const params: ParamMetadata[] = [{ index: 0, name: '' } as ParamMetadata];

      expect(() => buildSchemaFromParams(params)).toThrow();
    });

    it('should sort parameters by index', () => {
      const params: ParamMetadata[] = [
        { index: 2, name: 'third', type: String },
        { index: 0, name: 'first', type: String },
        { index: 1, name: 'second', type: String },
      ];

      const shape = buildSchemaFromParams(params);
      const keys = Object.keys(shape);

      expect(keys).toEqual(['first', 'second', 'third']);
    });
  });

  describe('zodShapeToJsonSchema', () => {
    it('should convert string schema', () => {
      const shape = { name: z.string().describe('User name') };
      const jsonSchema = zodShapeToJsonSchema(shape);

      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties.name).toEqual({
        type: 'string',
        description: 'User name',
      });
      expect(jsonSchema.required).toContain('name');
    });

    it('should convert number schema', () => {
      const shape = { count: z.number() };
      const jsonSchema = zodShapeToJsonSchema(shape);

      expect(jsonSchema.properties.count).toEqual({ type: 'number' });
    });

    it('should convert boolean schema', () => {
      const shape = { active: z.boolean() };
      const jsonSchema = zodShapeToJsonSchema(shape);

      expect(jsonSchema.properties.active).toEqual({ type: 'boolean' });
    });

    it('should convert enum schema', () => {
      const shape = { status: z.enum(['active', 'inactive']) };
      const jsonSchema = zodShapeToJsonSchema(shape);

      expect(jsonSchema.properties.status).toEqual({
        type: 'string',
        enum: ['active', 'inactive'],
      });
    });

    it('should handle optional fields', () => {
      const shape = {
        required: z.string(),
        optional: z.string().optional(),
      };
      const jsonSchema = zodShapeToJsonSchema(shape);

      expect(jsonSchema.required).toContain('required');
      expect(jsonSchema.required).not.toContain('optional');
    });

    it('should convert array schema', () => {
      const shape = { items: z.array(z.string()) };
      const jsonSchema = zodShapeToJsonSchema(shape);

      expect(jsonSchema.properties.items).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
    });

    it('should convert nested object schema', () => {
      const shape = {
        nested: z.object({
          inner: z.string(),
        }),
      };
      const jsonSchema = zodShapeToJsonSchema(shape);

      expect(jsonSchema.properties.nested).toEqual({
        type: 'object',
        properties: {
          inner: { type: 'string' },
        },
        required: ['inner'],
      });
    });

    it('should handle default values', () => {
      const shape = { count: z.number().default(10) };
      const jsonSchema = zodShapeToJsonSchema(shape);

      expect(jsonSchema.properties.count).toEqual({
        type: 'number',
        default: 10,
      });
    });
  });
});
