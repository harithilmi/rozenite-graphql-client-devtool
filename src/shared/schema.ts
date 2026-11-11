import {
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
  type GraphQLArgument as JsArgument,
  type GraphQLField as JsField,
  type GraphQLInputField,
  type GraphQLNamedType,
  type GraphQLObjectType,
  type GraphQLSchema as JsSchema,
} from 'graphql';
import type { GraphQLField, GraphQLSchema, GraphQLType, GraphQLTypeKind } from './types';

const toArg = (arg: JsArgument) => ({
  name: arg.name,
  type: arg.type.toString(),
  description: arg.description ?? undefined,
  defaultValue: arg.defaultValue === undefined ? undefined : JSON.stringify(arg.defaultValue),
});

const toField = (field: JsField<unknown, unknown> | GraphQLInputField): GraphQLField => ({
  name: field.name,
  type: field.type.toString(),
  description: field.description ?? undefined,
  args: 'args' in field ? field.args.map(toArg) : undefined,
  isDeprecated: field.deprecationReason != null,
  deprecationReason: field.deprecationReason ?? undefined,
});

const kindOf = (type: GraphQLNamedType): GraphQLTypeKind => {
  if (isScalarType(type)) return 'SCALAR';
  if (isEnumType(type)) return 'ENUM';
  if (isInputObjectType(type)) return 'INPUT_OBJECT';
  if (isInterfaceType(type)) return 'INTERFACE';
  if (isUnionType(type)) return 'UNION';
  return 'OBJECT';
};

const toType = (schema: JsSchema, type: GraphQLNamedType): GraphQLType => ({
  name: type.name,
  kind: kindOf(type),
  description: type.description ?? undefined,
  fields:
    isObjectType(type) || isInterfaceType(type) || isInputObjectType(type)
      ? Object.values(type.getFields()).map(toField)
      : undefined,
  enumValues: isEnumType(type) ? type.getValues().map((value) => value.name) : undefined,
  interfaces: isObjectType(type) ? type.getInterfaces().map((i) => i.name) : undefined,
  possibleTypes:
    isUnionType(type) || isInterfaceType(type)
      ? schema.getPossibleTypes(type).map((t) => t.name)
      : undefined,
});

const root = (schema: JsSchema, type: GraphQLObjectType | null | undefined) =>
  type ? toType(schema, type) : undefined;

/** graphql-js schema -> the plain, serialisable shape the panel uses */
export const toDevtoolSchema = (schema: JsSchema): GraphQLSchema => ({
  queryType: root(schema, schema.getQueryType()),
  mutationType: root(schema, schema.getMutationType()),
  subscriptionType: root(schema, schema.getSubscriptionType()),
  types: Object.values(schema.getTypeMap())
    .filter((type) => !type.name.startsWith('__'))
    .map((type) => toType(schema, type)),
});
