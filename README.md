# Rozenite GraphQL Client DevTool

A powerful debugging plugin for GraphQL clients in React Native applications, built for the Rozenite developer tools platform.

[![npm version](https://img.shields.io/npm/v/rozenite-graphql-client-devtool.svg)](https://www.npmjs.com/package/rozenite-graphql-client-devtool)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 📺 Demo

![preview-ezgif com-video-to-webp-converter (3)](https://github.com/user-attachments/assets/72b440dc-5580-4c03-9881-2388ea8012d7)

---

## 🌟 Overview

The Rozenite GraphQL Client DevTool provides a comprehensive debugging interface for monitoring and inspecting GraphQL operations in React Native applications. It supports multiple GraphQL clients through a flexible adapter pattern and offers real-time operation tracking, cache inspection, and schema exploration.

### Key Features

- 🔍 **Real-time Operation Tracking** - Monitor all GraphQL queries, mutations, and subscriptions as they happen
- 📊 **Cache Inspector** - Browse and explore your GraphQL client's cache entries
- 🗺️ **Schema Explorer** - Navigate through your GraphQL schema with detailed type information
- 🔌 **Multi-Client Support** - Built-in adapters for Apollo Client, with support for custom adapters
- 🎯 **Filtering & Search** - Powerful filtering and search capabilities across all tabs
- 📝 **Detailed Inspection** - View query text, variables, response data, errors, and timing information

### Supported GraphQL Client

- ⚡ **Apollo**

#### Coming Soon
- ⚡ **URQL**  
- ⚡ **Relay** 

---

## 📦 Installation

```bash
# Using npm
npm install rozenite-graphql-client-devtool

# Using yarn
yarn add rozenite-graphql-client-devtool

# Using pnpm
pnpm add rozenite-graphql-client-devtool
```

 

For Apollo Client support:
```bash
npm install @apollo/client graphql
```

---

## 🚀 Quick Start

### Apollo Client Setup

For complete operation tracking (including mutation responses and subscriptions), you need to add the Link to your Apollo Client configuration:

```typescript
import { ApolloClient, InMemoryCache, ApolloLink, HttpLink, ApolloProvider } from '@apollo/client';
import { apolloGraphqlDevtoolLink, useGraphqlClientDevtool } from 'rozenite-graphql-client-devtool';

// 1. Create the DevToolLink Link
const devToolLink = apolloGraphqlDevtoolLink();

// 2. Create your HTTP Link
const httpLink = new HttpLink({
  uri: 'https://api.example.com/graphql',
});

// 3. Combine links - Rozenite Link MUST be first
const client = new ApolloClient({
  link: ApolloLink.from([
    devToolLink,  // ⚠️ IMPORTANT: Must be first to capture all operations
    httpLink,
  ]),
  cache: new InMemoryCache(),
});

function App() {
  // 4. Initialize the devtool
  useGraphqlClientDevtool({
    client,
    clientType: 'apollo',
  });

  return (
    <ApolloProvider client={client}>
      {/* Your app components */}
    </ApolloProvider>
  );
}
```

 
---

## 🔧 Configuration

### API Reference

#### `useGraphqlClientDevtool(config)`

The main hook for integrating your GraphQL client with Rozenite DevTools.

##### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `client` | `any` | **required** | Your GraphQL client instance (Apollo Client or custom) |
| `clientType` | `'apollo' \| 'custom'` | **required** | The type of GraphQL client |
| `adapter` | `GraphQLClientAdapter` | `undefined` | Custom adapter implementation (required if `clientType` is `'custom'`) |
| `includeVariables` | `boolean` | `true` | Whether to include variables in operation tracking |
| `includeResponseData` | `boolean` | `true` | Whether to include response data in operation tracking |

##### Example with Options

```typescript
useGraphqlClientDevtool({
  client: apolloClient,
  clientType: 'apollo',
  includeVariables: true,
  includeResponseData: true,
});
```

---

## 🎯 Features in Detail

### 1. Operations Tab

A Network-panel style list of every GraphQL operation, modelled on the
[GraphQL Network Inspector](https://github.com/warrenday/graphql-network-inspector) extension.

**Features:**
- Table with type badge (Q / M / S), HTTP status, response size, duration and URL, oldest first (follows new rows like DevTools)
- Red rows for failed requests (network error, HTTP 4xx/5xx), amber badge + `200 · 1 err` for responses that carry GraphQL `errors`
- Live elapsed time for pending operations
- Filter by name with **Invert** and **Regex**; matches are highlighted
- Toggle Queries / Mutations / Subscriptions from the footer, which also shows totals (count, failures, bytes received)
- **Search** (⌘/Ctrl+F) across queries, variables, responses and headers; opening a hit marks it in the details pane
- Details pane (resizable) with **Headers** (URL, status, timing, sizes, request and response headers), **Request** (query + variables), **Response** (JSON tree with error cards) and **Response (Raw)**
- Copy query, variables, response, headers, or the whole request **as cURL**
- ↑ / ↓ to move between operations, Esc to close the details
- Follows the DevTools light / dark theme

URL, status and headers come from the fetch `Response` that Apollo's `HttpLink` puts on the operation context, so no extra setup is needed.
The Explorer tab's introspection query is sent only when you open that tab, and it is not listed in Operations.

### 2. Cache Tab

Inspect and explore your GraphQL client's cache entries.

**Features:**
- View all cache entries with their keys and data
- Group entries by typename for better organization
- Search and filter by key or typename
- Detailed cache entry viewer with interactive JSON tree
- Refresh button to request latest cache snapshot
- Entry metadata (timestamp, key, typename)
- Empty state when cache is empty

### 3. Explorer Tab

Browse your GraphQL schema and available operations.

**Features:**
- Display all available queries, mutations, and subscriptions
- Search through operations by name
- Filter by category (All, Queries, Mutations, Subscriptions)
- View detailed operation information:
  - Arguments with types, descriptions, and default values
  - Return types with nested field information
  - Field descriptions from schema
  - Deprecation warnings
- Expandable/collapsible operation details
- Color-coded by operation type
- Type system exploration

---

## 🔌 Custom Adapters (Work in Progress)

If you're using a GraphQL client that isn't Apollo, you can create a custom adapter.

### Creating a Custom Adapter

```typescript
import { GraphQLClientAdapter, GraphQLOperation } from 'rozenite-graphql-client-devtool';

class MyCustomAdapter implements GraphQLClientAdapter {
  constructor(private client: MyGraphQLClient) {}

  // Subscribe to operations
  subscribeToOperations(callback: (operation: GraphQLOperation) => void): () => void {
    // Implement your subscription logic here
    const unsubscribe = this.client.on('operation', (op) => {
      callback({
        id: generateId(),
        operationName: op.name,
        operationType: op.type,
        query: op.query,
        variables: op.variables,
        status: 'loading',
        timestamp: Date.now(),
        // ... other required fields
      });
    });

    return unsubscribe;
  }

  // Subscribe to cache changes
  subscribeToCacheChanges(callback: (cacheSnapshot: any) => void): () => void {
    // Implement cache subscription logic
    return () => {}; // Return cleanup function
  }

  // Get current cache snapshot
  async getCacheSnapshot(): Promise<any> {
    return this.client.extract();
  }

  // Get schema information
  async getSchema(): Promise<any> {
    return this.client.getSchema();
  }
}

// Usage
useGraphqlClientDevtool({
  client: myCustomClient,
  clientType: 'custom',
  adapter: new MyCustomAdapter(myCustomClient),
});
```

### Adapter Interface

```typescript
interface GraphQLClientAdapter {
  /**
   * Subscribe to GraphQL operations
   * @param callback - Called when an operation is executed or updated
   * @returns Cleanup function to unsubscribe
   */
  subscribeToOperations(
    callback: (operation: GraphQLOperation) => void
  ): () => void;

  /**
   * Subscribe to cache changes
   * @param callback - Called when cache is updated
   * @returns Cleanup function to unsubscribe
   */
  subscribeToCacheChanges(
    callback: (cacheSnapshot: any) => void
  ): () => void;

  /**
   * Get current cache snapshot
   * @returns Promise resolving to cache data
   */
  getCacheSnapshot(): Promise<any>;

  /**
   * Get GraphQL schema
   * @returns Promise resolving to schema introspection result
   */
  getSchema(): Promise<any>;

  /**
   * Optional: Clear the cache
   */
  clearCache?(): Promise<void>;
}
```
 
 
---

## 📚 TypeScript Support

This package is written in TypeScript and includes complete type definitions.

```typescript
import type {
  GraphQLOperation,
  GraphQLClientAdapter,
  OperationType,
  OperationStatus,
} from 'rozenite-graphql-client-devtool';
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Preview the panel in a browser

```bash
npm run preview   # http://localhost:3200
```

This runs the DevTools panel with a mock bridge (`preview/mock-bridge.ts`) that replays demo operations
from `preview/fixtures.ts`. Press `r` to send them again. To preview with your own app's operations, add a
git-ignored `preview/fixtures.local.ts` that exports `fixtures` (see `preview/op.ts` for the helper).

---

## 📄 License

MIT 

 

 
---

## 📞 Support

For issues, questions, or feature requests, please file an issue.

---

## 🔮 Roadmap

- [ ] **URQL client support**  
- [ ] **Relay Modern support**
---

**Made with ❤️ for React Native developers**
