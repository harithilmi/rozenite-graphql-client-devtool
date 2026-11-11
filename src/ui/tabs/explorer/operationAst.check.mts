// Run: node --experimental-strip-types src/ui/tabs/explorer/operationAst.check.mts
import assert from 'node:assert/strict';
import { isSelected, parseOperation, toggleField } from './operationAst.ts';

const book = { name: 'book', type: 'Book', args: [{ name: 'id', type: 'ID!' }] };
const title = { name: 'title', type: 'String!' };
const stock = { name: 'stock', type: 'Int!' };

let { text, addedVariables } = toggleField('', 'query', [book, title]);
assert.deepEqual(addedVariables, [{ name: 'id', type: 'ID!' }]);
assert.match(text, /query ExampleQuery\(\$id: ID!\) \{\n  book\(id: \$id\) \{\n    title/);

text = toggleField(text, 'query', [book, stock]).text;
assert.ok(isSelected(parseOperation(text), 'query', ['book', 'stock']));

// Removing the last child removes the parent and its now-unused variable
text = toggleField(text, 'query', [book, title]).text;
text = toggleField(text, 'query', [book, stock]).text;
assert.equal(text, '');

// A mutation replaces a query operation
const r = toggleField('query A { x }', 'mutation', [{ name: 'addToCart', type: 'Cart' }]);
assert.match(r.text, /^mutation ExampleMutation/);
console.log('ok');
