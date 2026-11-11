/// <reference types="vite/client" />
// Demo data for the browser preview. Everything here is made up.
// Drop a `fixtures.local.ts` next to this file (git-ignored) that exports
// `fixtures` to preview with operations from your own app.
import { op, type FixtureSet } from './op';
import { demoSchema } from './schema';

const demo: FixtureSet = {
  operations: [
    {
      operation: op({
        name: 'GetViewer',
        query: `query GetViewer {
  viewer {
    id
    name
    email
    avatarUrl
    plan
  }
}`,
        data: {
          viewer: {
            __typename: 'User',
            id: 'user_42',
            name: 'Aisha Rahman',
            email: 'aisha@example.com',
            avatarUrl: 'https://cdn.example.com/a/42.png',
            plan: 'PRO',
          },
        },
        duration: 182,
      }),
    },
    {
      operation: op({
        name: 'ListBooks',
        query: `query ListBooks($first: Int!, $after: String, $genre: Genre) {
  books(first: $first, after: $after, genre: $genre) {
    edges {
      node {
        id
        title
        author {
          id
          name
        }
        price
        rating
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`,
        variables: { first: 3, after: null, genre: 'SCIENCE' },
        data: {
          books: {
            __typename: 'BookConnection',
            edges: [
              { node: { __typename: 'Book', id: 'b1', title: 'The Gene', author: { __typename: 'Author', id: 'a1', name: 'S. Mukherjee' }, price: 18.5, rating: 4.6 } },
              { node: { __typename: 'Book', id: 'b2', title: 'Cosmos', author: { __typename: 'Author', id: 'a2', name: 'C. Sagan' }, price: 14, rating: 4.8 } },
              { node: { __typename: 'Book', id: 'b3', title: 'Entangled Life', author: { __typename: 'Author', id: 'a3', name: 'M. Sheldrake' }, price: 16.25, rating: 4.4 } },
            ],
            pageInfo: { __typename: 'PageInfo', hasNextPage: true, endCursor: 'YXJyYXljb25uZWN0aW9uOjI=' },
          },
        },
        duration: 342,
      }),
    },
    {
      operation: op({
        name: 'GetBook',
        query: `query GetBook($id: ID!) {
  book(id: $id) {
    id
    title
    description
    stock
  }
}`,
        variables: { id: 'b2' },
        data: {
          book: {
            __typename: 'Book',
            id: 'b2',
            title: 'Cosmos',
            description: 'A personal voyage through the universe.',
            stock: 12,
          },
        },
        duration: 96,
      }),
    },
    {
      operation: op({
        name: 'AddToCart',
        type: 'mutation',
        query: `mutation AddToCart($input: AddToCartInput!) {
  addToCart(input: $input) {
    cart {
      id
      itemCount
      total
    }
  }
}`,
        variables: { input: { bookId: 'b2', quantity: 1 } },
        data: {
          addToCart: {
            __typename: 'AddToCartPayload',
            cart: { __typename: 'Cart', id: 'cart_7', itemCount: 3, total: 49.25 },
          },
        },
        duration: 211,
      }),
    },
    {
      operation: op({
        name: 'ApplyCoupon',
        type: 'mutation',
        query: `mutation ApplyCoupon($code: String!) {
  applyCoupon(code: $code) {
    cart {
      id
      total
    }
  }
}`,
        variables: { code: 'SPRING25' },
        data: { applyCoupon: null },
        errors: [
          {
            message: 'Coupon SPRING25 has expired',
            locations: [{ line: 2, column: 3 }],
            path: ['applyCoupon'],
            extensions: { code: 'COUPON_EXPIRED' },
          },
        ],
        duration: 158,
      }),
    },
    {
      operation: op({
        name: 'GetRecommendations',
        query: `query GetRecommendations($limit: Int = 5) {
  recommendations(limit: $limit) {
    id
    title
  }
}`,
        variables: { limit: 5 },
        networkError: 'Response not successful: Received status code 503',
        status: 503,
        duration: 1204,
      }),
    },
    {
      operation: op({
        name: 'GetOrderHistory',
        query: `query GetOrderHistory {
  orders(last: 20) {
    id
    placedAt
    total
  }
}`,
        duration: 0,
      }),
      pending: true,
    },
  ],
  cache: [
    {
      id: 'ROOT_QUERY',
      key: 'ROOT_QUERY',
      typename: 'Query',
      data: { __typename: 'Query', viewer: { __ref: 'User:user_42' } },
      timestamp: 0,
    },
    {
      id: 'User:user_42',
      key: 'User:user_42',
      typename: 'User',
      data: { __typename: 'User', id: 'user_42', name: 'Aisha Rahman', plan: 'PRO' },
      timestamp: 0,
    },
    {
      id: 'Book:b2',
      key: 'Book:b2',
      typename: 'Book',
      data: { __typename: 'Book', id: 'b2', title: 'Cosmos', stock: 12 },
      timestamp: 0,
    },
  ],
  schema: demoSchema,
};

const local = import.meta.glob<{ fixtures: FixtureSet }>('./fixtures.local.ts', {
  eager: true,
});

export const fixtures: FixtureSet = Object.values(local)[0]?.fixtures ?? demo;
