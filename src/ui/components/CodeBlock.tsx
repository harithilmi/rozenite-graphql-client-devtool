import { useMemo } from 'react';
import { highlight, type CodeLanguage } from '../utils/highlight';
import { cn } from '../utils/cn';

export function CodeBlock({ code, language, className }: { code: string; language: CodeLanguage; className?: string }) {
  const html = useMemo(() => highlight(code, language), [code, language]);
  return (
    <pre className={cn('overflow-x-auto whitespace-pre font-mono text-[11.5px] leading-[18px]', className)}>
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}
