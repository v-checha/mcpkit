/**
 * Symbol keys for storing metadata on decorated classes
 * Using Symbols ensures no collision with user-defined properties
 */
export const METADATA_KEYS = {
  /** Server configuration options */
  SERVER_OPTIONS: Symbol('mcpkit:server:options'),
  /** Array of tool metadata */
  TOOLS: Symbol('mcpkit:tools'),
  /** Array of resource metadata */
  RESOURCES: Symbol('mcpkit:resources'),
  /** Array of prompt metadata */
  PROMPTS: Symbol('mcpkit:prompts'),
  /** Parameter metadata prefix (combined with method name) */
  PARAMS: Symbol('mcpkit:params'),
  /** TypeScript design-time type metadata */
  DESIGN_TYPE: 'design:type',
  /** TypeScript design-time parameter types */
  DESIGN_PARAMTYPES: 'design:paramtypes',
  /** TypeScript design-time return type */
  DESIGN_RETURNTYPE: 'design:returntype',
} as const;

export type MetadataKey = (typeof METADATA_KEYS)[keyof typeof METADATA_KEYS];
