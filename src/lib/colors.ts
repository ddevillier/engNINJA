
export function pastel(index:number, alpha=0.35): string {
  const hue = (index * 47) % 360
  return `hsla(${hue} 70% 70% / ${alpha})`
}
