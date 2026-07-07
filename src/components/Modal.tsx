import type { ReactNode } from 'react';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
}

/**
 * Wrapper genérico para mostrar contenido arbitrario (formularios, no solo
 * alert/confirm/prompt) sobre la pantalla actual. Distinto de ModalProvider
 * (que es imperativo y solo maneja mensajes simples) — este es declarativo,
 * el padre controla cuándo se muestra vía `onClose`. Reutiliza `.modal-overlay`
 * para que el fondo se vea igual que el resto de los modales de la app.
 */
export function Modal({ onClose, children }: ModalProps) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-panel" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
