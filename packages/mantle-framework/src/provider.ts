import { z } from "zod";
import {
  type CheckConfig,
  type CheckDefinition,
  checkConfigSchema,
} from "./check.ts";

type CheckBinding<TCheck extends CheckDefinition> = {
  check: TCheck;
  enabled?: boolean; // default true
  defaults?: CheckConfig<TCheck["operators"][number]>;
};

type TargetTypeDefinition<
  TSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TChecks extends Record<string, CheckBinding<CheckDefinition>> = Record<
    string,
    CheckBinding<CheckDefinition>
  >,
> = {
  schema: TSchema;
  checks: TChecks;
  defaultInterval?: string;
};

type ProviderDefinition<
  TName extends string = string,
  TProviderConfig extends z.ZodTypeAny = z.ZodTypeAny,
  TTargetTypes extends Record<string, TargetTypeDefinition> = Record<
    string,
    TargetTypeDefinition
  >,
> = {
  name: TName;
  config: TProviderConfig;
  targetTypes: TTargetTypes;
  defaultInterval?: string;
};

export function defineProvider<
  TName extends string,
  TProviderConfig extends z.ZodTypeAny,
  const TTargetTypes extends Record<string, TargetTypeDefinition>,
>(definition: {
  name: TName;
  config: TProviderConfig;
  targetTypes: TTargetTypes;
  defaultInterval?: string;
}): ProviderDefinition<TName, TProviderConfig, TTargetTypes> {
  return definition;
}

/**
 * Helper to bind a check to a target type with optional defaults
 */
export function bindCheck<TCheck extends CheckDefinition>(
  check: TCheck,
  options?: {
    enabled?: boolean;
    defaults?: CheckConfig<TCheck["operators"][number]>;
  },
): CheckBinding<TCheck> {
  const binding: CheckBinding<TCheck> = { check };
  if (options?.enabled !== undefined) {
    binding.enabled = options.enabled;
  }
  if (options?.defaults !== undefined) {
    binding.defaults = options.defaults;
  }
  return binding;
}

/**
 * Generate the provider-level config schema from a provider definition.
 * Includes connection config + checks per target type + intervals
 */
export function providerConfigSchema<
  TProviderConfig extends z.ZodTypeAny,
  TTargetTypes extends Record<string, TargetTypeDefinition>,
>(
  config: TProviderConfig,
  targetTypes: TTargetTypes,
  providerName: string,
): z.ZodType {
  const checksShape: Record<string, z.ZodTypeAny> = {};

  for (const [targetTypeName, targetType] of Object.entries(targetTypes)) {
    const targetChecksShape: Record<string, z.ZodTypeAny> = {};

    for (const [checkName, binding] of Object.entries(targetType.checks)) {
      const schema = checkConfigSchema(binding.check.operators);
      targetChecksShape[checkName] = schema.optional();
    }

    checksShape[targetTypeName] = z.object(targetChecksShape).optional();
  }

  const intervalsShape: Record<string, z.ZodTypeAny> = {};
  for (const targetTypeName of Object.keys(targetTypes)) {
    intervalsShape[targetTypeName] = z.string().optional();
  }

  return z
    .object({
      type: z.literal(providerName).optional(),
      interval: z.string().optional(),
      intervals: z.object(intervalsShape).optional(),
      checks: z.object(checksShape).optional(),
    })
    .and(config);
}

/**
 * Generate the target config schema for a specific target type.
 */
export function targetConfigSchema<TTargetType extends TargetTypeDefinition>(
  targetTypeName: string,
  targetType: TTargetType,
  providerFieldName: string = "provider",
): z.ZodType {
  const checksShape: Record<string, z.ZodTypeAny> = {};

  for (const [checkName, binding] of Object.entries(targetType.checks)) {
    const schema = checkConfigSchema(binding.check.operators);
    checksShape[checkName] = schema.optional();
  }

  return z
    .object({
      name: z.string(),
      [providerFieldName]: z.string(),
      type: z.literal(targetTypeName),
      interval: z.string().optional(),
      checks: z.object(checksShape).optional(),
    })
    .and(targetType.schema);
}

/**
 * Generate a discriminated union of all target types for a provider.
 */
export function allTargetConfigsSchema<
  TTargetTypes extends Record<string, TargetTypeDefinition>,
>(targetTypes: TTargetTypes): z.ZodType {
  const schemas = Object.entries(targetTypes).map(([name, targetType]) =>
    targetConfigSchema(name, targetType),
  );

  if (schemas.length === 0) {
    throw new Error("Provider must have at least one target type");
  }

  if (schemas.length === 1) {
    return schemas[0]!;
  }

  return z.union(schemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

export type { CheckBinding, ProviderDefinition, TargetTypeDefinition };
