import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success', duration = 4000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-55 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const icons = {
              success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
              error: <AlertCircle className="w-5 h-5 text-rose-500" />,
              info: <Info className="w-5 h-5 text-blue-500" />,
            };

            const typeStyles = {
              success: 'border-emerald-100 dark:border-emerald-950 bg-emerald-50/90 dark:bg-emerald-950/20',
              error: 'border-rose-100 dark:border-rose-950 bg-rose-50/90 dark:bg-rose-950/20',
              info: 'border-blue-100 dark:border-blue-950 bg-blue-50/90 dark:bg-blue-950/20',
            };

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                layout
                className={`p-4 rounded-xl border flex items-start gap-3 shadow-lg pointer-events-auto backdrop-blur-md ${typeStyles[t.type]}`}
              >
                <div className="mt-0.5">{icons[t.type]}</div>
                <div className="flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {t.message}
                </div>
                <button
                  onClick={() => removeToast(t.id)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
