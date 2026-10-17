import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FLOW_LABELS,
  FONT_LABELS,
  FONT_SIZE,
  LINE_HEIGHT,
  MARGIN_LABELS,
  READER_FLOWS,
  READER_FONTS,
  READER_MARGINS,
  READER_THEMES,
  type ReaderSettings,
  THEME_LABELS,
  stepFontSize,
  stepLineHeight,
} from "@/lib/reader-settings"

export function ReaderSettingsPanel({
  open,
  onOpenChange,
  settings,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: ReaderSettings
  onChange: (patch: Partial<ReaderSettings>) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Tampilan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <ChoiceGroup
            legend="Huruf"
            name="reader-font"
            options={READER_FONTS}
            labels={FONT_LABELS}
            value={settings.font}
            onChange={(font) => onChange({ font })}
          />
          <Stepper
            label="Ukuran huruf"
            value={`${settings.fontSize}%`}
            decreaseLabel="Perkecil huruf"
            increaseLabel="Perbesar huruf"
            canDecrease={settings.fontSize > FONT_SIZE.min}
            canIncrease={settings.fontSize < FONT_SIZE.max}
            onStep={(direction) =>
              onChange({ fontSize: stepFontSize(settings.fontSize, direction) })
            }
          />
          <Stepper
            label="Spasi baris"
            value={settings.lineHeight.toFixed(1)}
            decreaseLabel="Rapatkan baris"
            increaseLabel="Renggangkan baris"
            canDecrease={settings.lineHeight > LINE_HEIGHT.min}
            canIncrease={settings.lineHeight < LINE_HEIGHT.max}
            onStep={(direction) =>
              onChange({
                lineHeight: stepLineHeight(settings.lineHeight, direction),
              })
            }
          />
          <ChoiceGroup
            legend="Margin"
            name="reader-margin"
            options={READER_MARGINS}
            labels={MARGIN_LABELS}
            value={settings.margin}
            onChange={(margin) => onChange({ margin })}
          />
          <ChoiceGroup
            legend="Tema"
            name="reader-theme"
            options={READER_THEMES}
            labels={THEME_LABELS}
            value={settings.theme}
            onChange={(theme) => onChange({ theme })}
          />
          <ChoiceGroup
            legend="Tata letak"
            name="reader-flow"
            options={READER_FLOWS}
            labels={FLOW_LABELS}
            value={settings.flow}
            onChange={(flow) => onChange({ flow })}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  labels,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: ReadonlyArray<T>
  labels: Record<T, string>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 font-bold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className="choice-chip">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {labels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Stepper({
  label,
  value,
  decreaseLabel,
  increaseLabel,
  canDecrease,
  canIncrease,
  onStep,
}: {
  label: string
  value: string
  decreaseLabel: string
  increaseLabel: string
  canDecrease: boolean
  canIncrease: boolean
  onStep: (direction: 1 | -1) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-bold">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={decreaseLabel}
          disabled={!canDecrease}
          onClick={() => onStep(-1)}
        >
          −
        </Button>
        <output aria-label={label} className="w-12 text-center tabular-nums">
          {value}
        </output>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={increaseLabel}
          disabled={!canIncrease}
          onClick={() => onStep(1)}
        >
          +
        </Button>
      </div>
    </div>
  )
}
