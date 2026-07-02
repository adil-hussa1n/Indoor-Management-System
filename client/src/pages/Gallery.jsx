import React, { useState, useEffect } from 'react';
import { usePublicGallery } from '../hooks/useApi';
import { Loader } from '../components/ui/Loader';
import { Dialog } from '../components/ui/Dialog';
import { useSocket } from '../contexts/SocketContext';

export const Gallery = () => {
  const { data: images, isLoading, refetch } = usePublicGallery();
  const [activeImage, setActiveImage] = useState(null);
  const socket = useSocket();

  useEffect(() => {
    if (socket) {
      const handleGalleryUpdate = () => {
        console.log('Realtime gallery update received');
        refetch();
      };
      socket.on('gallery-updated', handleGalleryUpdate);
      return () => {
        socket.off('gallery-updated', handleGalleryUpdate);
      };
    }
  }, [socket, refetch]);

  const thirtySixtyMedia = images?.filter((img) => img.is360) || [];
  const standardMedia = images?.filter((img) => !img.is360) || [];

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
        <div className="space-y-16">
          {/* 360 Media Viewer Section (Pinned on Top) */}
          {thirtySixtyMedia.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <span className="bg-purple-650/10 text-purple-600 dark:text-purple-400 font-extrabold text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border border-purple-500/20 shadow-sm animate-pulse">
                  360° Virtual Tour
                </span>
                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">Interactive Arena Showcase</h2>
              </div>
              
              <div className="grid grid-cols-1 gap-8">
                {thirtySixtyMedia.map((item) => (
                  <div key={item._id} className="relative rounded-3xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800 bg-black shadow-lg">
                    {item.mediaType === 'video' ? (
                      <video
                        src={item.imageUrl}
                        controls
                        autoPlay={item.autoPlay360}
                        loop
                        muted
                        className="w-full h-[450px] object-cover"
                      />
                    ) : (
                      <iframe
                        src={`https://pannellum.org/js/pannellum.htm?panorama=${encodeURIComponent(item.imageUrl)}&autoLoad=true${item.autoPlay360 ? '&autoRotate=-2' : ''}`}
                        className="w-full h-[450px] border-0"
                        allowFullScreen
                        title="360 Court Tour"
                      />
                    )}
                    <div className="absolute bottom-4 left-4 z-10 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-white text-xs font-bold shadow select-none">
                      {item.mediaType === 'video' ? 'Interactive 360° Video playback' : 'Drag / swipe to look around the court in 360°'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standard Media Section */}
          {standardMedia.length > 0 && (
            <div className="space-y-6">
              {thirtySixtyMedia.length > 0 && (
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 border-t border-zinc-200 dark:border-zinc-800 pt-10">
                  Photos & Action Highlights
                </h3>
              )}
              
              <div className="columns-1 sm:columns-2 md:columns-3 gap-6 space-y-6">
                {standardMedia.map((img) => (
                  <div
                    key={img._id}
                    onClick={() => setActiveImage(img)}
                    className="break-inside-avoid overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group relative bg-zinc-100 dark:bg-zinc-900"
                  >
                    {img.mediaType === 'video' ? (
                      <div className="relative">
                        <video
                          src={img.imageUrl}
                          muted
                          className="w-full h-auto object-cover max-h-96"
                        />
                        <div className="absolute top-2 left-2 bg-black/50 text-white text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">
                          Video
                        </div>
                      </div>
                    ) : (
                      <img
                        src={img.imageUrl}
                        alt="Arena Feature"
                        loading="lazy"
                        className="w-full h-auto object-cover max-h-96 transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <span className="text-white text-xs font-bold uppercase tracking-wider bg-black/60 px-4 py-2 rounded-full backdrop-blur-sm">
                        View Full Screen
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox Dialog */}
      <Dialog
        isOpen={!!activeImage}
        onClose={() => setActiveImage(null)}
        title={activeImage?.mediaType === 'video' ? 'Arena Video Showcase' : 'Arena Image Preview'}
        className="max-w-3xl"
      >
        {activeImage && (
          <div className="w-full h-full flex items-center justify-center p-2">
            {activeImage.mediaType === 'video' ? (
              <video
                src={activeImage.imageUrl}
                controls
                autoPlay
                className="max-w-full max-h-[70vh] rounded-xl shadow-lg border border-zinc-200/20"
              />
            ) : (
              <img
                src={activeImage.imageUrl}
                alt="Full Screen Preview"
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg border border-zinc-200/20"
              />
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
};
