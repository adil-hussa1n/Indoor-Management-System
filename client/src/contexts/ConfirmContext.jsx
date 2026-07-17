import React, { createContext, useContext, useState, useRef } from 'react';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { AlertTriangle } from 'lucide-react';

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState({
    title: 'Are you sure?',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'danger',
  });

  const resolverRef = useRef(null);

  const confirm = (options = {}) => {
    setConfig({
      title: options.title || 'Are you sure?',
      message: options.message || '',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      type: options.type || 'danger',
    });
    setIsOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
    }
  };

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        isOpen={isOpen}
        onClose={handleCancel}
        title={config.title}
        className="max-w-md"
      >
        <div className="flex flex-col gap-4 text-left pt-2">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              config.type === 'danger'
                ? 'bg-red-50 text-red-500 dark:bg-red-950/20'
                : 'bg-purple-50 text-purple-650 dark:bg-purple-950/20'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-sm text-zinc-650 dark:text-zinc-400 leading-relaxed pt-1">
              {config.message}
            </p>
          </div>

          <div className="flex justify-end gap-3 border-t border-zinc-150 dark:border-zinc-800/80 pt-4 mt-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="px-4 py-2 font-bold cursor-pointer"
            >
              {config.cancelText}
            </Button>
            <Button
              onClick={handleConfirm}
              className={`px-5 py-2 font-bold cursor-pointer shadow-sm ${
                config.type === 'danger'
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 focus:ring-red-500/20'
                  : ''
              }`}
            >
              {config.confirmText}
            </Button>
          </div>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};
