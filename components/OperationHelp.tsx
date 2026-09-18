import React, { useEffect, useId, useRef, useState } from 'react';
import { CircleHelp, Keyboard, X } from 'lucide-react';
import './OperationHelp.css';

const SHORTCUT_GROUPS = [
  {
    title: '編輯快捷鍵',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], label: '復原上一步' },
      { keys: ['Ctrl', 'Y'], label: '重做', detail: '也可使用 Ctrl + Shift + Z' },
      { keys: ['Ctrl', 'C'], label: '複製選取物件', detail: '未選取物件時，複製整張畫布' },
      { keys: ['Ctrl', 'V'], label: '貼上物件或圖片' },
      { keys: ['Ctrl', 'D'], label: '建立選取物件的副本' },
      { keys: ['Delete'], label: '刪除選取物件', detail: '也可使用 Backspace' },
      { keys: ['Esc'], label: '取消選取，回到選取工具' },
      { keys: ['Alt', 'S'], label: '擷取螢幕' },
    ],
  },
  {
    title: '選取與移動',
    shortcuts: [
      { keys: ['Shift', '點擊'], label: '加入或移除多選物件', detail: '使用選取工具時' },
      { keys: ['拖曳空白處'], label: '框選多個物件', detail: '使用選取工具時' },
      { keys: ['Ctrl', '點擊'], label: '暫時選取物件', detail: '其他繪圖工具也能使用' },
      { keys: ['Alt', '拖曳'], label: '移動物件時暫時關閉吸附' },
      { keys: ['手掌工具', '拖曳'], label: '移動畫布視窗' },
      { keys: ['雙擊文字'], label: '編輯文字或標註框', detail: 'Enter 換行；Esc 取消這次編輯' },
    ],
  },
  {
    title: '繪圖與其他操作',
    shortcuts: [
      { keys: ['Shift', '拖曳'], label: '繪製正方形或正圓', detail: '矩形、圓形、三角形、菱形與矩形螢光筆' },
      { keys: ['Shift', '拖曳'], label: '直線與箭頭吸附 45°' },
      { keys: ['Shift', '拖曳'], label: '自由螢光筆保持水平' },
      { keys: ['Shift', '拉畫布邊界'], label: '畫布尺寸以 50px 為單位調整' },
      { keys: ['雙擊名稱'], label: '重新命名圖層或分頁' },
    ],
  },
];

const OperationHelp: React.FC = () => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pinnedRef = useRef(false);
  const hoveringRef = useRef(false);
  const panelId = useId();
  const headingId = useId();

  const close = (restoreFocus = false) => {
    if (restoreFocus) buttonRef.current?.focus({ preventScroll: true });
    pinnedRef.current = false;
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        pinnedRef.current = false;
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Dismiss help before the editor's Escape shortcut clears the selection.
      event.preventDefault();
      event.stopPropagation();
      if (containerRef.current?.contains(document.activeElement)) {
        buttonRef.current?.focus({ preventScroll: true });
      }
      pinnedRef.current = false;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="operation-help"
      onPointerEnter={event => {
        if (event.pointerType === 'touch') return;
        hoveringRef.current = true;
        setOpen(true);
      }}
      onPointerLeave={() => {
        hoveringRef.current = false;
        if (!pinnedRef.current && !containerRef.current?.contains(document.activeElement)) setOpen(false);
      }}
      onFocusCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(true);
      }}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          pinnedRef.current = false;
          if (!hoveringRef.current) setOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="operation-help-trigger"
        aria-label="操作方式與快捷鍵"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => {
          if (pinnedRef.current) close();
          else {
            pinnedRef.current = true;
            setOpen(true);
          }
        }}
      >
        <CircleHelp size={14} aria-hidden="true" />
        操作方式
      </button>

      {open && (
        <div className="operation-help-positioner">
          <section id={panelId} role="dialog" aria-labelledby={headingId} className="operation-help-panel">
            <header className="operation-help-header">
              <span className="operation-help-icon"><Keyboard size={19} aria-hidden="true" /></span>
              <div>
                <h2 id={headingId}>操作方式</h2>
                <p>快捷鍵與畫布操作</p>
              </div>
              <button type="button" className="operation-help-close" aria-label="關閉操作方式" onClick={() => close(true)}>
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <div className="operation-help-content" tabIndex={0} aria-label="快捷鍵清單，可捲動查看">
              {SHORTCUT_GROUPS.map(group => (
                <section key={group.title} className="operation-help-section">
                  <h3>{group.title}</h3>
                  <dl>
                    {group.shortcuts.map(shortcut => (
                      <div key={shortcut.label} className="operation-help-row">
                        <dt>
                          {shortcut.label}
                          {'detail' in shortcut && <span className="operation-help-detail">{shortcut.detail}</span>}
                        </dt>
                        <dd>
                          {shortcut.keys.map((key, index) => (
                            <React.Fragment key={key}>
                              {index > 0 && <span className="operation-help-plus" aria-hidden="true">+</span>}
                              <kbd>{key}</kbd>
                            </React.Fragment>
                          ))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
              <p className="operation-help-note">Mac 的 Ctrl 組合鍵請使用 ⌘ Command。點擊「操作方式」可固定展開，按 Esc 或點擊外側即可關閉。</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default OperationHelp;
