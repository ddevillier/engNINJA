import { 
  PASTEL_HUE_STEP, 
  DEFAULT_PASTEL_ALPHA, 
  DEFAULT_PASTEL_SATURATION, 
  DEFAULT_PASTEL_LIGHTNESS 
} from './constants'

export function pastel(
  index: number, 
  alpha = DEFAULT_PASTEL_ALPHA
): string {
  const hue = (index * PASTEL_HUE_STEP) % 360
  return `hsla(${hue} ${DEFAULT_PASTEL_SATURATION}% ${DEFAULT_PASTEL_LIGHTNESS}% / ${alpha})`
}
