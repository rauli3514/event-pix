import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { getGeneralSettings, saveGeneralSettings, validTrivia, type TriviaQuestion } from '@/lib/kioskSettings';
import { buttonClass, inputClass, Panel } from './ui';

// Preguntas de la trivia de la fiesta: uno de los juegos mientras se espera la foto.
// Con al menos una pregunta completa, la trivia entra en el sorteo de juegos.

const EXAMPLES: TriviaQuestion[] = [
  { q: '¿Dónde se conocieron los novios?', options: ['En la facu', 'En un cumple', 'En el trabajo'], answer: 1 },
  { q: '¿Cuántos años de novios llevan?', options: ['3', '5', '8'], answer: 1 },
  { q: '¿Cuál es la comida favorita de la cumpleañera?', options: ['Pizza', 'Sushi', 'Asado'], answer: 0 },
];

const empty = (): TriviaQuestion => ({ q: '', options: ['', '', ''], answer: 0 });

export default function TriviaPanel() {
  const [list, setList] = useState<TriviaQuestion[]>(() => getGeneralSettings().triviaQuestions ?? []);
  const save = (next: TriviaQuestion[]) => {
    setList(next);
    saveGeneralSettings({ triviaQuestions: next });
  };
  const edit = (i: number, patch: Partial<TriviaQuestion>) => save(list.map((q, n) => (n === i ? { ...q, ...patch } : q)));
  const ready = validTrivia(list).length;

  return (
    <Panel title="Trivia de la fiesta" description="Preguntas sobre los novios, la quinceañera o el cumpleañero. Es uno de los juegos mientras se espera la foto. Marcá con ✓ la respuesta correcta.">
      {list.map((q, i) => (
        <div key={i} className="rounded-2xl bg-black/20 border border-white/10 p-4 space-y-3">
          <div className="flex gap-3">
            <input className={inputClass} placeholder={`Pregunta ${i + 1}`} value={q.q} onChange={e => edit(i, { q: e.target.value })} />
            <button onClick={() => save(list.filter((_, n) => n !== i))} className={buttonClass} aria-label="Borrar pregunta">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          {q.options.map((o, j) => (
            <div key={j} className="flex gap-3">
              <button onClick={() => edit(i, { answer: j })} aria-label="Respuesta correcta"
                className={`${buttonClass} w-16 shrink-0 ${q.answer === j ? '!bg-[#00c853]' : ''}`}>
                {q.answer === j ? '✓' : ''}
              </button>
              <input className={inputClass} placeholder={`Opción ${j + 1}${j === 2 ? ' (opcional)' : ''}`} value={o}
                onChange={e => edit(i, { options: q.options.map((x, n) => (n === j ? e.target.value : x)) })} />
            </div>
          ))}
        </div>
      ))}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => save([...list, empty()])} className={buttonClass}>
          <Plus className="w-5 h-5" /> Agregar pregunta
        </button>
        {!list.length && (
          <button onClick={() => save(EXAMPLES)} className={buttonClass}>Cargar ejemplos para editar</button>
        )}
      </div>
      <p className="text-white/50">
        {ready ? `${ready} pregunta${ready === 1 ? '' : 's'} lista${ready === 1 ? '' : 's'}: la trivia entra en los juegos.` : 'Sin preguntas completas la trivia no aparece.'}
      </p>
    </Panel>
  );
}
