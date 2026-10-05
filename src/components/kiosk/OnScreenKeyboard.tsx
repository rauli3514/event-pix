import { useEffect, useRef, useState } from 'react';
import { ArrowBigUp, Check, Delete } from 'lucide-react';
import { rotateArrowKey } from '@/lib/screenRotation';

// Teclado en pantalla para los campos de texto cuando la tele está girada: el
// teclado de Android se abre siempre apaisado (de costado), así que se lo apaga
// (inputmode="none") y se usa este, que gira con la app. Anda con toque, mouse
// o el control remoto (flechas + OK).

const TEXT_TYPES = new Set(['', 'text', 'search', 'url', 'email', 'tel', 'password', 'number']);
const isTextField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT_TYPES.has((el as HTMLInputElement).type)))
  && !(el as HTMLInputElement).readOnly && !(el as HTMLInputElement).disabled;

const LETTERS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
  ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'],
  ['?123', '@', ' ', '.', '✓'],
];
const SYMBOLS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '$', '%', '&', '-', '_', '+', '=', '/'],
  [':', ';', '(', ')', '!', '?', '"', "'", ',', '*'],
  ['á', 'é', 'í', 'ó', 'ú', '♥', '<', '>', '⌫'],
  ['ABC', '.com', ' ', '.', '✓'],
];

/** Escribe en el campo como si fuera el teclado (React se entera por el evento input). */
function insert(el: HTMLInputElement | HTMLTextAreaElement, text: string | null) {
  const value = el.value;
  let start = value.length;
  let end = value.length;
  try {
    start = el.selectionStart ?? value.length;
    end = el.selectionEnd ?? value.length;
  } catch {
    // type="number"/"email" no tienen selección: se escribe al final
  }
  let next: string;
  let caret: number;
  if (text === null) {
    if (start === end && start === 0) return;
    const from = start === end ? start - 1 : start;
    next = value.slice(0, from) + value.slice(end);
    caret = from;
  } else {
    next = value.slice(0, start) + text + value.slice(end);
    caret = start + text.length;
  }
  if (el.maxLength > 0 && next.length > el.maxLength) return;
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  try {
    el.setSelectionRange(caret, caret);
  } catch {
    // sin selección
  }
}

export default function OnScreenKeyboard() {
  const [target, setTarget] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [shift, setShift] = useState(false);
  const [symbols, setSymbols] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Apaga el teclado del sistema en todos los campos (también los que aparecen después)
  useEffect(() => {
    const mark = (root: ParentNode) => {
      root.querySelectorAll('input, textarea').forEach(el => {
        if (isTextField(el) && el.getAttribute('inputmode') !== 'none') {
          el.setAttribute('data-osk-inputmode', el.getAttribute('inputmode') ?? '');
          el.setAttribute('inputmode', 'none');
        }
      });
    };
    mark(document);
    const mo = new MutationObserver(() => mark(document));
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      document.querySelectorAll('[data-osk-inputmode]').forEach(el => {
        const prev = el.getAttribute('data-osk-inputmode');
        if (prev) el.setAttribute('inputmode', prev); else el.removeAttribute('inputmode');
        el.removeAttribute('data-osk-inputmode');
      });
    };
  }, []);

  // Se abre al enfocar un campo y se cierra al ir a otro lado
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element;
      if (boxRef.current?.contains(el)) return;
      if (isTextField(el)) {
        if (el.getAttribute('inputmode') !== 'none') el.setAttribute('inputmode', 'none');
        setTarget(el);
      } else {
        setTarget(null);
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as Element;
      if (boxRef.current?.contains(el) || isTextField(el)) return;
      setTarget(null);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  // Control remoto: del campo se baja al teclado; dentro del teclado las flechas lo recorren
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      const box = boxRef.current;
      if (!box) return;
      const active = document.activeElement as HTMLElement | null;
      const key = rotateArrowKey(e.key);
      if (e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack') {
        if (active && box.contains(active)) target.focus();
        setTarget(null);
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (active === target && key === 'ArrowDown') {
        box.querySelector<HTMLElement>('[data-row="1"][data-col="0"]')?.focus();
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (!active || !box.contains(active) || !active.dataset.row) return;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const row = Number(active.dataset.row);
      const col = Number(active.dataset.col);
      const rowKeys = (r: number) => Array.from(box.querySelectorAll<HTMLElement>(`[data-row="${r}"]`));
      const rows = (symbols ? SYMBOLS : LETTERS).length;
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const keys = rowKeys(row);
        keys[(col + (key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length]?.focus();
        return;
      }
      const nextRow = row + (key === 'ArrowDown' ? 1 : -1);
      if (nextRow < 0) { target.focus(); return; }
      if (nextRow >= rows) return;
      // Misma posición horizontal en la fila de arriba/abajo
      const x = active.getBoundingClientRect();
      const cx = x.left + x.width / 2;
      let best: HTMLElement | null = null;
      let dist = Infinity;
      for (const k of rowKeys(nextRow)) {
        const r = k.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - cx);
        if (d < dist) { dist = d; best = k; }
      }
      best?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [target, symbols]);

  // Deja lugar abajo (--osk-h) y lleva el campo a la vista, para que el teclado no lo tape
  useEffect(() => {
    const root = document.documentElement;
    if (!target) { root.style.removeProperty('--osk-h'); return; }
    const h = boxRef.current?.offsetHeight ?? 0;
    root.style.setProperty('--osk-h', `${h}px`);
    const t = setTimeout(() => target.scrollIntoView({ block: 'center' }), 50);
    return () => { clearTimeout(t); root.style.removeProperty('--osk-h'); };
  }, [target, symbols]);

  if (!target || !document.contains(target)) return null;

  const press = (k: string) => {
    if (k === '⇧') return setShift(s => !s);
    if (k === '?123') return setSymbols(true);
    if (k === 'ABC') return setSymbols(false);
    if (k === '⌫') return insert(target, null);
    if (k === '✓') {
      target.blur();
      return setTarget(null);
    }
    insert(target, shift ? k.toUpperCase() : k);
    if (shift) setShift(false);
  };

  const rows = symbols ? SYMBOLS : LETTERS;
  const keyClass = 'h-[min(7.5vmin,4.2rem)] rounded-xl bg-white/12 border border-white/15 text-white font-semibold text-[min(3.4vmin,1.6rem)] flex items-center justify-center hover:bg-white/25 focus:outline-none focus:ring-4 focus:ring-[#00d4ff] focus:bg-white/30 active:scale-95 transition-transform select-none';
  const width = (k: string) => (k === ' ' ? 'flex-[5]' : k === '✓' || k === '?123' || k === 'ABC' || k === '.com' ? 'flex-[1.8]' : k === '⇧' || k === '⌫' ? 'flex-[1.5]' : 'flex-1');

  return (
    <div ref={boxRef} className="fixed inset-x-0 bottom-0 z-[9999] bg-[#0b0820]/95 backdrop-blur border-t border-white/15 p-[1.2vmin] pb-[1.6vmin] shadow-[0_-20px_50px_rgba(0,0,0,0.6)]"
      // que tocar una tecla no le saque el foco al campo
      onPointerDown={e => { if ((e.target as HTMLElement).closest('button')) e.preventDefault(); }}>
      <div className="mx-auto max-w-5xl flex flex-col gap-[0.9vmin]">
        {rows.map((row, r) => (
          <div key={r} className="flex gap-[0.9vmin]">
            {row.map((k, c) => (
              <button key={k + c} type="button" data-row={r} data-col={c} onClick={() => press(k)}
                className={`${keyClass} ${width(k)} ${k === '✓' ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] border-transparent' : ''} ${k === '⇧' && shift ? 'bg-white/40' : ''}`}>
                {k === '⌫' ? <Delete className="w-[3.5vmin] h-[3.5vmin]" />
                  : k === '⇧' ? <ArrowBigUp className="w-[3.5vmin] h-[3.5vmin]" />
                  : k === '✓' ? <><Check className="w-[3vmin] h-[3vmin] mr-1" /> Listo</>
                  : k === ' ' ? 'espacio'
                  : shift ? k.toUpperCase() : k}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
