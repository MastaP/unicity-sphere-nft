import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { secondaryButton } from './ui';

interface CopyButtonProps {
  value: string;
  /** What is being copied, for the accessible name ("Copy token id"). */
  label: string;
}

export function CopyButton({ value, label }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 1800);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      // Clipboard access can be denied, e.g. inside a sandboxed frame.
      setState('failed');
    }
  };

  return (
    <button type="button" onClick={copy} className={secondaryButton} aria-label={`Copy ${label}`}>
      {state === 'copied' ? <Check aria-hidden className="h-4 w-4 text-green-400" /> : <Copy aria-hidden className="h-4 w-4" />}
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}</span>
    </button>
  );
}
