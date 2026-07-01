import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFound = () => {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center text-center p-4">
      <div className="w-16 h-16 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center mb-6">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-extrabold text-zinc-900 dark:text-white mb-2">
        Page Not Found (404)
      </h1>
      <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-sm leading-relaxed">
        The page you are looking for does not exist or has been moved to a new destination.
      </p>
      <Link to="/">
        <Button className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Go Back Home
        </Button>
      </Link>
    </div>
  );
};
