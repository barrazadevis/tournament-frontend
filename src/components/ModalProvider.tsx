import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  title?: string;
  defaultValue?: string;
  placeholder?: string;
}

type ModalRequest =
  | { kind: 'alert'; message: string; title?: string }
  | ({ kind: 'confirm'; message: string } & ConfirmOptions)
  | ({ kind: 'prompt'; message: string } & PromptOptions);

interface ModalContextValue {
  alertModal: (message: string, title?: string) => Promise<void>;
  confirmModal: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  promptModal: (message: string, options?: PromptOptions) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal debe usarse dentro de <ModalProvider>');
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ModalRequest | null>(null);
  const [inputValue, setInputValue] = useState('');
  const resolverRef = useRef<((value: unknown) => void) | null>(null);

  const close = useCallback((value: unknown) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  const alertModal = useCallback((message: string, title?: string) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setRequest({ kind: 'alert', message, title });
    });
  }, []);

  const confirmModal = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = (value) => resolve(value as boolean);
      setRequest({ kind: 'confirm', message, ...options });
    });
  }, []);

  const promptModal = useCallback((message: string, options?: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = (value) => resolve(value as string | null);
      setInputValue(options?.defaultValue ?? '');
      setRequest({ kind: 'prompt', message, ...options });
    });
  }, []);

  return (
    <ModalContext.Provider value={{ alertModal, confirmModal, promptModal }}>
      {children}
      {request && (
        <div
          className="modal-overlay"
          onMouseDown={() => {
            if (request.kind === 'confirm') close(false);
            else if (request.kind === 'prompt') close(null);
          }}
        >
          <div className="modal-box" onMouseDown={(e) => e.stopPropagation()}>
            {request.title && <h3 className="modal-title">{request.title}</h3>}
            <p className="modal-message">{request.message}</p>

            {request.kind === 'prompt' && (
              <input
                autoFocus
                className="modal-input"
                value={inputValue}
                placeholder={request.placeholder}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') close(inputValue.trim() || null);
                  if (e.key === 'Escape') close(null);
                }}
              />
            )}

            <div className="modal-actions">
              {request.kind === 'alert' && (
                <button className="modal-btn modal-btn-primary" onClick={() => close(undefined)}>
                  Entendido
                </button>
              )}
              {request.kind === 'confirm' && (
                <>
                  <button className="modal-btn modal-btn-secondary" onClick={() => close(false)}>
                    {request.cancelLabel ?? 'Cancelar'}
                  </button>
                  <button
                    className={`modal-btn ${request.danger ? 'modal-btn-danger' : 'modal-btn-primary'}`}
                    onClick={() => close(true)}
                  >
                    {request.confirmLabel ?? 'Confirmar'}
                  </button>
                </>
              )}
              {request.kind === 'prompt' && (
                <>
                  <button className="modal-btn modal-btn-secondary" onClick={() => close(null)}>
                    Cancelar
                  </button>
                  <button className="modal-btn modal-btn-primary" onClick={() => close(inputValue.trim() || null)}>
                    Aceptar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}
