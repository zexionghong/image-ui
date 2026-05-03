import { RotateCcw } from 'lucide-react'
import { useEditorStore } from '@/store/useEditorStore'
import { DEFAULT_FILTERS } from '@/types'
import { useTranslations } from '@/i18n/compat/client'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

export function FilterPanel() {
  const { filters: currentFilters, setFilter, resetFilters } = useEditorStore()
  const t = useTranslations('editor')

  const filters = [
    { key: 'brightness' as const, label: t('brightness'), min: 0, max: 200, default: 100 },
    { key: 'contrast' as const, label: t('contrast'), min: 0, max: 200, default: 100 },
    { key: 'saturation' as const, label: t('saturation'), min: 0, max: 200, default: 100 },
    { key: 'blur' as const, label: t('blur'), min: 0, max: 20, default: 0, step: 0.5 },
    { key: 'hue' as const, label: t('hueRotate'), min: 0, max: 360, default: 0 },
    { key: 'sepia' as const, label: t('sepia'), min: 0, max: 100, default: 0 },
    { key: 'grayscale' as const, label: t('grayscale'), min: 0, max: 100, default: 0 },
    { key: 'invert' as const, label: t('invert'), min: 0, max: 100, default: 0 },
  ]

  const presets = [
    { name: t('normal'), filters: DEFAULT_FILTERS },
    { name: t('vintage'), filters: { ...DEFAULT_FILTERS, sepia: 40, contrast: 110, brightness: 95, saturation: 80 } },
    { name: t('bw'), filters: { ...DEFAULT_FILTERS, grayscale: 100, contrast: 120 } },
    { name: t('warm'), filters: { ...DEFAULT_FILTERS, sepia: 20, brightness: 105, saturation: 120 } },
    { name: t('cool'), filters: { ...DEFAULT_FILTERS, hue: 180, saturation: 80 } },
    { name: t('highContrast'), filters: { ...DEFAULT_FILTERS, contrast: 150, brightness: 110 } },
    { name: t('faded'), filters: { ...DEFAULT_FILTERS, brightness: 110, contrast: 85, saturation: 70 } },
    { name: t('dramatic'), filters: { ...DEFAULT_FILTERS, contrast: 140, saturation: 130, brightness: 90 } },
  ]

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('adjustments')}</h3>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            {t('reset')}
          </Button>
        </div>

        <Tabs defaultValue="adjust">
          <TabsList className="w-full">
            <TabsTrigger value="adjust" className="flex-1">{t('adjustments')}</TabsTrigger>
            <TabsTrigger value="presets" className="flex-1">{t('presets')}</TabsTrigger>
          </TabsList>

          <TabsContent value="adjust" className="space-y-4 mt-4">
            {filters.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">{f.label}</label>
                  <span className="text-xs text-muted-foreground w-8 text-right">{currentFilters[f.key]}</span>
                </div>
                <Slider min={f.min} max={f.max} step={f.step || 1} value={[currentFilters[f.key]]} onValueChange={([v]) => setFilter(f.key, v)} className="cursor-pointer" />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="presets" className="mt-4">
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => { Object.entries(preset.filters).forEach(([k, v]) => { setFilter(k as keyof typeof currentFilters, v) }) }}
                  className="rounded-lg border border-border p-3 text-left text-xs font-medium transition-colors hover:bg-accent hover:border-accent"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  )
}
