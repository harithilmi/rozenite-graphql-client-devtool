import { useMemo, useRef, type KeyboardEvent } from 'react';
import { highlight, type CodeLanguage } from '../utils/highlight';
import { cn } from '../utils/cn';

interface Props {
  value: string;
  onChange: (value: string) => void;
  language: CodeLanguage;
  placeholder?: string;
  /** ⌘/Ctrl+Enter */
  onRun?: () => void;
  label: string;
  className?: string;
}

/** Plain textarea with a syntax-highlighted copy drawn underneath (same font + padding) */
export function CodeEditor({ value, onChange, language, placeholder, onRun, label, className }: Props) {
  const preRef = useRef<HTMLPreElement>(null);
  const html = useMemo(() => highlight(value, language), [value, language]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onRun?.();
    }
    // Tab indents instead of leaving the field
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      const el = event.currentTarget;
      el.setRangeText('  ', el.selectionStart, el.selectionEnd, 'end');
      onChange(el.value);
    }
  };

  const shared = 'm-0 whitespace-pre p-3 font-mono text-[11.5px] leading-[18px]';
  return (
    <div className={cn('relative min-h-0', className)}>
      <pre ref={preRef} aria-hidden className={cn(shared, 'pointer-events-none absolute inset-0 overflow-hidden')}>
        {/* Trailing newline keeps the last line's height in sync with the textarea */}
        <code dangerouslySetInnerHTML={{ __html: `${html}\n` }} />
      </pre>
      <textarea
        aria-label={label}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        wrap="off"
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={onKeyDown}
        onScroll={(event) => {
          if (!preRef.current) return;
          preRef.current.scrollTop = event.currentTarget.scrollTop;
          preRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
        className={cn(
          shared,
          'absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent text-transparent caret-foreground outline-none',
          'placeholder:text-muted-foreground selection:bg-primary/25',
        )}
      />
    </div>
  );
}
