import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Palette, X } from 'lucide-react';
import { Appearance, DEFAULT_THEME_COLOR, THEME_COLORS } from '../utils/appearance';
import './AppearanceMenu.css';

interface AppearanceMenuProps {
  appearance: Appearance;
  onAppearanceChange: (appearance: Appearance) => void;
  color: string;
  onColorChange: (color: string) => void;
}

const AppearanceMenu: React.FC<AppearanceMenuProps> = ({ appearance, onAppearanceChange, color, onColorChange }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, bottom: 44, width: 360 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const headingId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const bounds = buttonRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const width = Math.min(360, window.innerWidth - 24);
      setPosition({ width, left: Math.max(12, Math.min(bounds.right - width, window.innerWidth - width - 12)), bottom: window.innerHeight - bounds.top + 8 });
    };
    reposition();
    window.addEventListener('resize', reposition);
    return () => window.removeEventListener('resize', reposition);
  }, [open, appearance]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div className="appearance-menu" ref={containerRef} onBlurCapture={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
      <button ref={buttonRef} type="button" className="appearance-menu-trigger" aria-expanded={open} aria-controls={panelId} aria-haspopup="dialog" onClick={() => setOpen(value => !value)} title="選擇介面風格與主題顏色">
        <Palette size={14} aria-hidden="true" /><span>風格</span><ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} role="dialog" aria-labelledby={headingId} className="appearance-menu-panel" style={{ ...position, maxHeight: `calc(100dvh - ${position.bottom + 12}px)` }}>
          <div className="appearance-menu-heading">
            <h2 id={headingId}>介面風格</h2>
            <button type="button" aria-label="關閉風格選單" onClick={() => { setOpen(false); buttonRef.current?.focus(); }}><X size={16} /></button>
          </div>
          <p className="appearance-menu-description">選擇喜歡的外觀，設定會記在這台瀏覽器。</p>
          <div className="appearance-menu-options" role="group" aria-label="選擇風格">
            {([
              { id: 'original', name: '原始風格', description: '熟悉的藍色介面與俐落按鈕' },
              { id: 'material', name: 'Material You', description: '柔和色調、圓角按鈕與可調主題色' },
            ] as const).map(option => (
              <button key={option.id} type="button" className="appearance-menu-option" aria-pressed={appearance === option.id} onClick={() => onAppearanceChange(option.id)}>
                <span className={`appearance-menu-preview appearance-menu-preview-${option.id}`} aria-hidden="true"><span /><span /><span /></span>
                <span className="appearance-menu-option-text"><strong>{option.name}</strong><span>{option.description}</span></span>
                {appearance === option.id && <Check size={16} aria-hidden="true" />}
              </button>
            ))}
          </div>
          {appearance === 'material' && (
            <section className="appearance-menu-colors" aria-label="Material You 主題顏色">
              <h3>主題顏色</h3>
              <div className="appearance-menu-swatches" role="group" aria-label="預設主題色">
                {THEME_COLORS.map(preset => (
                  <button key={preset.color} type="button" aria-label={preset.label} title={preset.label} aria-pressed={color === preset.color} style={{ '--swatch': preset.color } as React.CSSProperties} onClick={() => onColorChange(preset.color)}>
                    {color === preset.color && <Check size={18} aria-hidden="true" />}
                  </button>
                ))}
              </div>
              <label className="appearance-menu-custom-color"><span>自訂顏色</span><code>{color.toUpperCase()}</code><input aria-label="自訂主題顏色" type="color" value={color} onChange={event => onColorChange(event.target.value)} /></label>
              <button type="button" className="appearance-menu-reset" onClick={() => onColorChange(DEFAULT_THEME_COLOR)}>恢復預設主題色</button>
              <p className="appearance-menu-description">只改變介面外觀，不會影響圖片、繪圖顏色或匯出結果。亮色與暗色模式皆適用。</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default AppearanceMenu;
