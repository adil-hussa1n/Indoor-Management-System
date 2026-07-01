import React, { useState } from 'react';
import { usePublicGallery } from '../hooks/useApi';
import { Loader } from '../components/ui/Loader';
import { Dialog } from '../components/ui/Dialog';

export const Gallery = () => {
  const { data: images, isLoading } = usePublicGallery();
  const [activeImage, setActiveImage] = useState(null);

  return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-left">
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-6 text-center">
        Our <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Gallery</span>
      </h1>
      
      <p className="text-lg text-zinc-650 dark:text-zinc-400 mb-12 text-center max-w-2xl mx-auto leading-relaxed">
        A sneak peek into our premium climate-controlled court, professional hardwood surfaces, and high-intensity game actions.
      </p>

      {isLoading ? (
        <Loader size="large" className="py-20" />
      ) : !images || images.length === 0 ? (
        <div className="text-center py-20 text-zinc-400 font-semibold border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          No gallery images available. Check back soon!
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 md:columns-3 gap-6 space-y-6">
          {images.map((img) => (
            <div
              key={img._id}
              onClick={() => setActiveImage(img)}
              className="break-inside-avoid overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group relative bg-zinc-100 dark:bg-zinc-900"
            >
              <img
                src={img.imageUrl}
                alt="Arena Feature"
                loading="lazy"
                className="w-full h-auto object-cover max-h-96 transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <span className="text-white text-xs font-bold uppercase tracking-wider bg-black/60 px-4 py-2 rounded-full backdrop-blur-sm">
                  View Full Screen
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Dialog */}
      <Dialog
        isOpen={!!activeImage}
        onClose={() => setActiveImage(null)}
        title="Arena Image Preview"
        className="max-w-3xl"
      >
        {activeImage && (
          <div className="w-full h-full flex items-center justify-center p-2">
            <img
              src={activeImage.imageUrl}
              alt="Full Screen Preview"
              className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg border border-zinc-200/20"
            />
          </div>
        )}
      </Dialog>
    </div>
  );
};
