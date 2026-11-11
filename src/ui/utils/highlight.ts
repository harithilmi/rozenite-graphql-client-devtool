import hljs from 'highlight.js/lib/core';
import graphql from 'highlight.js/lib/languages/graphql';
import json from 'highlight.js/lib/languages/json';

hljs.registerLanguage('graphql', graphql);
hljs.registerLanguage('json', json);

export type CodeLanguage = 'graphql' | 'json';

/** Returns escaped HTML with token spans (safe for dangerouslySetInnerHTML) */
export const highlight = (code: string, language: CodeLanguage): string =>
  hljs.highlight(code, { language }).value;
