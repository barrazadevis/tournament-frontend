import type { ReactNode } from 'react';

const KEYWORDS = new Set([
  'Proceso', 'FinProceso', 'Algoritmo', 'FinAlgoritmo',
  'Definir', 'Como', 'Dimension',
  'Leer', 'Escribir',
  'Si', 'Entonces', 'Sino', 'FinSi',
  'Mientras', 'FinMientras', 'Repetir', 'Hasta', 'Que',
  'Para', 'Con', 'Paso', 'Hacer', 'FinPara',
  'Segun', 'FinSegun',
  'Funcion', 'FinFuncion', 'Retornar',
  'Y', 'O', 'No', 'Verdadero', 'Falso',
]);

const TYPES = new Set(['Real', 'Entero', 'Caracter', 'Logico']);

// Cadenas / números / palabras, en ese orden — cada trozo que no matchea
// pasa como string plano (React lo escapa como cualquier otro texto).
const TOKEN_PATTERN = /("[^"]*")|(\b\d+(?:\.\d+)?\b)|([A-Za-zÁÉÍÓÚáéíóúñÑ_][A-Za-zÁÉÍÓÚáéíóúñÑ_0-9]*)/g;

/**
 * Tokeniza una línea de pseudocódigo a nodos React (texto + <span> por
 * palabra clave/tipo/cadena/número). Nunca arma HTML a mano ni usa
 * dangerouslySetInnerHTML — el contenido puede venir de la solución de un
 * equipo, así que cada fragmento pasa por JSX y React lo escapa igual que
 * cualquier otro texto.
 */
export function highlightPseudocodeLine(line: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(line)) !== null) {
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index));

    const [full, str, num, word] = match;
    if (str !== undefined) {
      nodes.push(<span key={key++} className="tok-str">{full}</span>);
    } else if (num !== undefined) {
      nodes.push(<span key={key++} className="tok-num">{full}</span>);
    } else if (word !== undefined) {
      if (KEYWORDS.has(word)) nodes.push(<span key={key++} className="tok-kw">{word}</span>);
      else if (TYPES.has(word)) nodes.push(<span key={key++} className="tok-ty">{word}</span>);
      else nodes.push(word);
    }
    lastIndex = TOKEN_PATTERN.lastIndex;
  }
  if (lastIndex < line.length) nodes.push(line.slice(lastIndex));

  return nodes;
}
