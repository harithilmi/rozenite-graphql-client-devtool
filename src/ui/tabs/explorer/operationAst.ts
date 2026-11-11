// Add/remove fields in an operation's text by editing its AST, like Apollo Sandbox's Documentation panel.
import {
  Kind,
  OperationTypeNode,
  parse,
  parseType,
  print,
  visit,
  type ArgumentNode,
  type DocumentNode,
  type FieldNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
  type VariableDefinitionNode,
} from 'graphql';
import type { GraphQLField } from '../../../shared/types';

export type RootKind = 'query' | 'mutation' | 'subscription';

const OPERATION_TYPE: Record<RootKind, OperationTypeNode> = {
  query: OperationTypeNode.QUERY,
  mutation: OperationTypeNode.MUTATION,
  subscription: OperationTypeNode.SUBSCRIPTION,
};

/** "[Book!]!" -> "Book" */
export const namedType = (type: string) => type.replace(/[[\]!]/g, '');

export const parseOperation = (text: string): DocumentNode | null => {
  try {
    return parse(text);
  } catch {
    return null;
  }
};

const operationOf = (document: DocumentNode | null) =>
  document?.definitions.find((d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION);

const fieldAt = (set: SelectionSetNode | undefined, name: string) =>
  set?.selections.find((s): s is FieldNode => s.kind === Kind.FIELD && !s.alias && s.name.value === name);

/** Is the field at `path` (field names from the root) in the operation? */
export const isSelected = (document: DocumentNode | null, kind: RootKind, path: string[]): boolean => {
  const operation = operationOf(document);
  if (!operation || operation.operation !== kind) return false;
  let set: SelectionSetNode | undefined = operation.selectionSet;
  for (const name of path) {
    const field = fieldAt(set, name);
    if (!field) return false;
    set = field.selectionSet;
  }
  return true;
};

/** Field node with its required arguments wired to new variables */
const buildField = (field: GraphQLField, taken: Set<string>) => {
  const variables: VariableDefinitionNode[] = [];
  const args: ArgumentNode[] = (field.args ?? [])
    .filter((arg) => arg.type.endsWith('!') && arg.defaultValue === undefined)
    .map((arg) => {
      let name = arg.name;
      for (let i = 2; taken.has(name); i++) name = `${arg.name}${i}`;
      taken.add(name);
      variables.push({
        kind: Kind.VARIABLE_DEFINITION,
        variable: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: name } },
        type: parseType(arg.type),
      });
      return {
        kind: Kind.ARGUMENT,
        name: { kind: Kind.NAME, value: arg.name },
        value: { kind: Kind.VARIABLE, name: { kind: Kind.NAME, value: name } },
      };
    });
  const node: FieldNode = { kind: Kind.FIELD, name: { kind: Kind.NAME, value: field.name }, arguments: args };
  return { node, variables };
};

/** Drop variable definitions nothing uses any more */
const pruneVariables = (operation: OperationDefinitionNode): OperationDefinitionNode => {
  const used = new Set<string>();
  visit(operation.selectionSet, { Variable: (node) => void used.add(node.name.value) });
  return {
    ...operation,
    variableDefinitions: operation.variableDefinitions?.filter((v) => used.has(v.variable.name.value)),
  };
};

/**
 * Toggle the field at the end of `fields` (the field objects along the path, from the root).
 * Returns the new operation text and the names of variables it added.
 */
export const toggleField = (
  text: string,
  kind: RootKind,
  fields: GraphQLField[],
): { text: string; addedVariables: Array<{ name: string; type: string }> } => {
  const document = parseOperation(text);
  const existing = operationOf(document);
  // Different root type (or nothing parsable): start a fresh operation
  const operation: OperationDefinitionNode =
    existing && existing.operation === kind
      ? existing
      : {
          kind: Kind.OPERATION_DEFINITION,
          operation: OPERATION_TYPE[kind],
          name: { kind: Kind.NAME, value: `Example${kind[0].toUpperCase()}${kind.slice(1)}` },
          variableDefinitions: [],
          selectionSet: { kind: Kind.SELECTION_SET, selections: [] },
        };

  const taken = new Set(operation.variableDefinitions?.map((v) => v.variable.name.value));
  const added: VariableDefinitionNode[] = [];

  /** New field node; its required-arg variables are registered on the operation */
  const newField = (field: GraphQLField): FieldNode => {
    const built = buildField(field, taken);
    added.push(...built.variables);
    return built.node;
  };

  const walk = (set: SelectionSetNode | undefined, index: number): SelectionSetNode | undefined => {
    const field = fields[index];
    const selections = set?.selections ?? [];
    const current = fieldAt(set, field.name);

    let next: FieldNode | undefined;
    if (index === fields.length - 1) {
      // The clicked field: remove it if present, else add it
      next = current ? undefined : newField(field);
    } else {
      const base = current ?? newField(field);
      const child = walk(base.selectionSet, index + 1);
      // A parent with no sub-fields left is invalid, so it goes too
      next = child && { ...base, selectionSet: child };
    }

    const updated = current
      ? selections.flatMap((s) => (s === current ? (next ? [next] : []) : [s]))
      : [...selections, ...(next ? [next] : [])];
    return updated.length ? { kind: Kind.SELECTION_SET, selections: updated } : undefined;
  };

  const selectionSet = walk(operation.selectionSet, 0) ?? { kind: Kind.SELECTION_SET, selections: [] };
  const updated = pruneVariables({
    ...operation,
    variableDefinitions: [...(operation.variableDefinitions ?? []), ...added],
    selectionSet,
  });

  const others = document?.definitions.filter((d) => d !== existing && existing?.operation === kind) ?? [];
  const output = selectionSet.selections.length
    ? print({ kind: Kind.DOCUMENT, definitions: [updated, ...others] })
    : '';
  return {
    text: output,
    addedVariables: added.map((v) => ({ name: v.variable.name.value, type: print(v.type) })),
  };
};
