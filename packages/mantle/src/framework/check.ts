import { z } from "zod";

export const ENABLED = "__enabled__" as const;
export const DISABLED = "__disabled__" as const;

export type Operator = "max" | "min" | "equals" | "not";

export type CheckDefinition<
  TName extends string = string,
  TMeasurement extends z.ZodTypeAny = z.ZodTypeAny,
  TOperators extends readonly Operator[] = readonly Operator[],
> = {
  name: TName;
  measurement: TMeasurement;
  operators: TOperators;
  defaults: CheckConfig<TOperators[number]>;
};

export type CheckConfig<TOp extends Operator = Operator> = {
  [K in TOp]?: K extends "max" | "min" ? number : unknown;
} & {
  over?: string;
};

export function defineCheck<
  TName extends string,
  TMeasurement extends z.ZodTypeAny,
  const TOperators extends readonly Operator[],
>(definition: {
  name: TName;
  measurement: TMeasurement;
  operators: TOperators;
  defaults: CheckConfig<TOperators[number]>;
}): CheckDefinition<TName, TMeasurement, TOperators> {
  return definition;
}

/**
 * Generate the user-facing config schema for a check.
 * Allows: __disabled__, __enabled__, or an object with operator fields + over
 */
export function checkConfigSchema<TOperators extends readonly Operator[]>(
  operators: TOperators,
): z.ZodType {
  const operatorFields: Record<string, z.ZodTypeAny> = {};

  for (const op of operators) {
    if (op === "max" || op === "min") {
      operatorFields[op] = z.number().optional();
    } else if (op === "equals" || op === "not") {
      operatorFields[op] = z.unknown().optional();
    }
  }

  operatorFields["over"] = z.string().optional();

  const configObject = z.object(operatorFields).passthrough();

  return z.union([
    z.literal(DISABLED),
    z.literal(ENABLED),
    configObject,
  ]);
}
