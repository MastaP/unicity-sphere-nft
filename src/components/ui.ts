/** Shared Tailwind class strings, kept whole so Tailwind's scanner sees every class. */

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900';

export const panel = 'rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5';

export const primaryButton = `inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const secondaryButton = `inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-100 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const textInput = `w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 ${focusRing}`;

export const fieldLabel = 'mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400';
