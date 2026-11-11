import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { cn } from '../utils/cn';
import { copyText } from '../utils/clipboard';

export function IconButton({ className, active, ...props }: ComponentProps<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded px-1 text-muted-foreground',
        'hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-40',
        active && 'text-primary',
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap text-foreground">
      <input
        type="checkbox"
        className="h-[13px] w-[13px] accent-[hsl(var(--primary))]"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      {label}
    </label>
  );
}

export const Divider = () => <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />;

/** Button that copies text and says "Copied" for a moment */
export function CopyButton({ text, children = 'Copy', className }: { text: string | null; children?: ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      disabled={text === null}
      onClick={async () => {
        if (text === null || !(await copyText(text))) return;
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1200);
      }}
      className={cn(
        'h-[22px] whitespace-nowrap rounded border border-border bg-background px-2 font-medium text-foreground',
        'hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-40',
        copied && 'border-success text-success',
        className,
      )}
    >
      {copied ? 'Copied' : children}
    </button>
  );
}

/**
 * Chrome DevTools tab look: grey text, grey fill on hover, active = blue text + blue underline.
 * Works for both `aria-selected` buttons and Radix `data-state="active"` triggers.
 */
export const TAB_CLASS = cn(
  'relative inline-flex items-center whitespace-nowrap px-3 text-muted-foreground',
  'hover:bg-muted hover:text-foreground',
  'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
  'aria-selected:text-primary aria-selected:hover:text-primary data-[state=active]:text-primary data-[state=active]:hover:text-primary',
  'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:opacity-0',
  'aria-selected:after:opacity-100 data-[state=active]:after:opacity-100',
);
