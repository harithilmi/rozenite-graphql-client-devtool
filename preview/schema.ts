// Demo schema for the browser preview, plus a resolver that answers any operation with fake data.
import {
  buildSchema,
  execute,
  getNullableType,
  isEnumType,
  isListType,
  isScalarType,
  parse,
  validate,
  type GraphQLFieldResolver,
  type GraphQLOutputType,
  type GraphQLTypeResolver,
} from 'graphql';
import { toDevtoolSchema } from '../src/shared/schema';
import type { ExecuteResult } from '../src/shared/types';

const sdl = /* GraphQL */ `
  "Entry point for reads"
  type Query {
    "The signed-in user"
    viewer: User!
    "Books, newest first"
    books(first: Int!, after: String, genre: Genre): BookConnection!
    book(id: ID!): Book
    search(term: String!): [SearchResult!]!
    orders(last: Int = 20): [Order!]!
  }

  type Mutation {
    addToCart(input: AddToCartInput!): AddToCartPayload!
    applyCoupon(code: String!): ApplyCouponPayload
  }

  type Subscription {
    orderStatusChanged(orderId: ID!): Order!
  }

  type User { id: ID! name: String! email: String! avatarUrl: String plan: Plan! cart: Cart }
  type Book { id: ID! title: String! description: String author: Author! price: Float! rating: Float stock: Int! genre: Genre! }
  type Author { id: ID! name: String! books: [Book!]! }
  type BookConnection { edges: [BookEdge!]! pageInfo: PageInfo! totalCount: Int! }
  type BookEdge { cursor: String! node: Book! }
  type PageInfo { hasNextPage: Boolean! endCursor: String }
  type Cart { id: ID! itemCount: Int! total: Float! }
  type Order { id: ID! placedAt: String! total: Float! status: OrderStatus! }
  type AddToCartPayload { cart: Cart! }
  type ApplyCouponPayload { cart: Cart }
  input AddToCartInput { bookId: ID! quantity: Int = 1 }
  union SearchResult = Book | Author
  enum Genre { SCIENCE FICTION HISTORY }
  enum Plan { FREE PRO }
  enum OrderStatus { PLACED SHIPPED DELIVERED @deprecated(reason: "Use SHIPPED") }
`;

const jsSchema = buildSchema(sdl);
export const demoSchema = toDevtoolSchema(jsSchema);

const SCALARS: Record<string, unknown> = { ID: 'id_1', String: 'Lorem ipsum', Int: 42, Float: 4.5, Boolean: true };

const mockValue = (type: GraphQLOutputType): unknown => {
  const inner = getNullableType(type);
  if (isListType(inner)) return [mockValue(inner.ofType), mockValue(inner.ofType)];
  if (isScalarType(inner)) return SCALARS[inner.name] ?? 'value';
  if (isEnumType(inner)) return inner.getValues()[0]?.value;
  return {}; // object: graphql-js resolves its fields with this resolver too
};

const fieldResolver: GraphQLFieldResolver<unknown, unknown> = (_source, _args, _context, info) =>
  mockValue(info.returnType);
const typeResolver: GraphQLTypeResolver<unknown, unknown> = (_value, _context, info, abstractType) =>
  info.schema.getPossibleTypes(abstractType)[0]?.name;

/** Run an operation against the demo schema with fake data */
export const mockExecute = async (
  query: string,
  variables?: Record<string, unknown>,
): Promise<Omit<ExecuteResult, 'requestId' | 'duration'>> => {
  try {
    const document = parse(query);
    const invalid = validate(jsSchema, document);
    if (invalid.length) return { errors: invalid.map((e) => ({ message: e.message })) };
    const result = await execute({ schema: jsSchema, document, variableValues: variables, fieldResolver, typeResolver });
    return { data: result.data, errors: result.errors?.map((e) => ({ message: e.message, path: e.path ? [...e.path] : undefined })) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};
