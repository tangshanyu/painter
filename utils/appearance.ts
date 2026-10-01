export type Appearance = 'original' | 'material';
export const DEFAULT_THEME_COLOR = '#6750a4';
export const THEME_COLORS = [
  { color: '#6750a4', label: '柔紫' },
  { color: '#0061a4', label: '海藍' },
  { color: '#386a20', label: '森綠' },
  { color: '#006a60', label: '青綠' },
  { color: '#8b5000', label: '暖橘' },
  { color: '#984061', label: '玫瑰' },
];

export const normalizeThemeColor = (color: string | null) => /^#[0-9a-f]{6}$/i.test(color ?? '') ? color!.toLowerCase() : DEFAULT_THEME_COLOR;

function rgb(color: string): number[] {
  return [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
}

function luminance(color: string): number {
  const channels = rgb(color).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first: string, second: string): number {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const foreground = (background: string) => contrastRatio(background, '#ffffff') >= contrastRatio(background, '#000000') ? '#ffffff' : '#000000';
const mix = (color: string, base: string, amount: number) => '#' + rgb(color).map((value, index) =>
  Math.round(value * amount + rgb(base)[index] * (1 - amount)).toString(16).padStart(2, '0')).join('');

// A lightweight seed-based tonal palette; theme tokens never alter document colors.
export function createMaterialTheme(seed: string, dark: boolean): Record<string, string> {
  const color = normalizeThemeColor(seed);
  const primary = dark ? mix(color, '#ffffff', 0.4) : contrastRatio(color, '#ffffff') < 4.5 ? mix(color, '#000000', 0.55) : color;
  const container = mix(color, dark ? '#18151d' : '#ffffff', dark ? 0.45 : 0.18);
  const secondary = mix(color, dark ? '#242127' : '#ffffff', dark ? 0.25 : 0.12);
  return {
    '--md-primary': primary,
    '--md-on-primary': foreground(primary),
    '--md-primary-container': container,
    '--md-on-primary-container': foreground(container),
    '--md-secondary-container': secondary,
    '--md-on-secondary-container': foreground(secondary),
    '--md-surface': mix(color, dark ? '#131215' : '#ffffff', 0.025),
    '--md-surface-low': mix(color, dark ? '#1c1a1f' : '#ffffff', 0.05),
    '--md-surface-container': mix(color, dark ? '#211f24' : '#ffffff', 0.07),
    '--md-surface-high': mix(color, dark ? '#2b292e' : '#ffffff', 0.11),
    '--md-on-surface': dark ? '#f0edf3' : '#1c1b1f',
    '--md-on-surface-variant': dark ? '#cac4d0' : '#49454f',
    '--md-outline': dark ? '#938f99' : '#79747e',
    '--md-outline-variant': mix(color, dark ? '#49454f' : '#cac4d0', 0.08),
  };
}
