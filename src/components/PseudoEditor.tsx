import { useRef } from 'react';
import { highlightPseudocodeLine } from '../utils/pseudocodeHighlight';

interface PseudoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  fileName?: string;
  readOnly?: boolean;
  compact?: boolean;
}

export function PseudoEditor({
  value,
  onChange,
  placeholder,
  fileName = 'solucion.psc',
  readOnly = false,
  compact = false,
}: PseudoEditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = value.length === 0 ? [''] : value.split('\n');

  const syncGutterScroll = (e: React.UIEvent<HTMLElement>) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  return (
    <div className={`pseudo-editor${compact ? ' pseudo-editor--compact' : ''}`}>
      <div className="pseudo-editor-titlebar">
        <span className="pseudo-editor-dots">
          <span className="pseudo-editor-dot dot-red" />
          <span className="pseudo-editor-dot dot-yellow" />
          <span className="pseudo-editor-dot dot-green" />
        </span>
        <span className="pseudo-editor-filename">{fileName}</span>
      </div>
      <div className="pseudo-editor-body">
        <div className="pseudo-editor-gutter" ref={gutterRef} aria-hidden="true">
          {lines.map((_, i) => (
            <div key={i} className="pseudo-editor-line-number">
              {i + 1}
            </div>
          ))}
        </div>
        {readOnly ? (
          <div className="pseudo-editor-code" onScroll={syncGutterScroll}>
            {lines.map((line, i) => (
              <div key={i} className="pseudo-editor-line">
                {line.length === 0 ? ' ' : highlightPseudocodeLine(line)}
              </div>
            ))}
          </div>
        ) : (
          <textarea
            className="pseudo-editor-textarea"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onScroll={syncGutterScroll}
            placeholder={placeholder}
            spellCheck={false}
            wrap="off"
          />
        )}
      </div>
    </div>
  );
}
