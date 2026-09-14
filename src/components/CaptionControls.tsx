import { RotateCcw } from 'lucide-react';
import type { CaptionSlot } from '../meme/captions';
import { MAX_SIZE_PERCENT, MIN_SIZE_PERCENT, type MemeSettings } from '../meme/render';
import { fieldLabel, focusRing, secondaryButton, textInput } from './ui';

export const CAPTION_MAX_LENGTH = 100;

interface CaptionControlsProps {
  settings: MemeSettings;
  onChange: (update: (previous: MemeSettings) => MemeSettings) => void;
  /** Captions that do not fit even at the smallest size. */
  overflow: Record<CaptionSlot, boolean>;
}

const LABELS: Record<CaptionSlot, string> = { top: 'Top text', bottom: 'Bottom text' };

export function CaptionControls({ settings, onChange, overflow }: CaptionControlsProps) {
  const moved = settings.top.position !== null || settings.bottom.position !== null;
  const checkbox = `h-4 w-4 rounded accent-orange-500 ${focusRing}`;

  return (
    <div className="space-y-3">
      {(['top', 'bottom'] as const).map((slot) => (
        <div key={slot}>
          <label htmlFor={`${slot}-text`} className={fieldLabel}>
            {LABELS[slot]}
          </label>
          <input
            id={`${slot}-text`}
            type="text"
            className={textInput}
            value={settings[slot].text}
            maxLength={CAPTION_MAX_LENGTH}
            placeholder={slot === 'top' ? 'One does not simply' : 'mint a meme'}
            autoComplete="off"
            aria-describedby={overflow[slot] ? `${slot}-overflow` : undefined}
            onChange={(event) => {
              const text = event.target.value;
              onChange((s) => ({ ...s, [slot]: { ...s[slot], text } }));
            }}
          />
          {overflow[slot] && (
            <p id={`${slot}-overflow`} className="mt-1 text-xs text-amber-400">
              Too long to fit. Shorten it or turn off auto-fit.
            </p>
          )}
        </div>
      ))}

      <div>
        <label htmlFor="caption-size" className={fieldLabel}>
          Text size <span className="normal-case text-neutral-500">({settings.sizePercent}%)</span>
        </label>
        <input
          id="caption-size"
          type="range"
          min={MIN_SIZE_PERCENT}
          max={MAX_SIZE_PERCENT}
          step={1}
          value={settings.sizePercent}
          className={`w-full accent-orange-500 ${focusRing}`}
          onChange={(event) => {
            const sizePercent = Number(event.target.value);
            onChange((s) => ({ ...s, sizePercent }));
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-200">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className={checkbox}
            checked={settings.uppercase}
            onChange={(event) => {
              const uppercase = event.target.checked;
              onChange((s) => ({ ...s, uppercase }));
            }}
          />
          Uppercase
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className={checkbox}
            checked={settings.autoFit}
            onChange={(event) => {
              const autoFit = event.target.checked;
              onChange((s) => ({ ...s, autoFit }));
            }}
          />
          Auto-fit
        </label>
        <button
          type="button"
          className={`${secondaryButton} ml-auto`}
          disabled={!moved}
          onClick={() =>
            onChange((s) => ({ ...s, top: { ...s.top, position: null }, bottom: { ...s.bottom, position: null } }))
          }
        >
          <RotateCcw aria-hidden className="h-4 w-4" />
          Reset positions
        </button>
      </div>
    </div>
  );
}
