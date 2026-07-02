import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFound = () => {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center text-center p-4 animate-fade-in">
      <div className="glass-card p-10 rounded-3xl max-w-md w-full shadow-lg border border-zinc-200/50 dark:border-zinc-800 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-650 dark:text-purple-400 flex items-center justify-center mb-6 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-2">
          Page Not Found (404)
        </h1>
        <p className="text-zinc-500 dark:text-zinc-405 mb-8 max-w-xs leading-relaxed text-sm">
          The page you are looking for does not exist or has been moved to a new destination.
        </p>
        <Link to="/" className="w-full">
          <Button className="w-full flex items-center justify-center gap-2 font-bold">
            <ArrowLeft className="w-4 h-4" /> Go Back Home
          </Button>
        </Link>
      </div>
    </div>
  );
};
