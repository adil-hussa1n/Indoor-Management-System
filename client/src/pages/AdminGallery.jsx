import React, { useState, useEffect } from 'react';
import { usePublicGallery, useUploadGalleryImage, useDeleteGalleryImage, useReorderGallery } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { Trash2, Upload, ArrowUp, ArrowDown } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';

export const AdminGallery = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [is360, setIs360] = useState(false);
  const [mediaType, setMediaType] = useState('image');
  const [autoPlay360, setAutoPlay360] = useState(true);
  const socket = useSocket();

  const { data: images, isLoading, refetch } = usePublicGallery();

  useEffect(() => {
    if (socket) {
      const handleGalleryUpdate = () => {
        console.log('Realtime gallery update received in Admin');
        refetch();
      };
      socket.on('gallery-updated', handleGalleryUpdate);
      return () => {
        socket.off('gallery-updated', handleGalleryUpdate);
      };
    }
  }, [socket, refetch]);

  const uploadMutation = useUploadGalleryImage();
  const deleteMutation = useDeleteGalleryImage();
  const reorderMutation = useReorderGallery();

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select an image file first');
      return;
    }

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('is360', is360);
    formData.append('mediaType', mediaType);
    formData.append('autoPlay360', autoPlay360);

    setUploading(true);
    uploadMutation.mutate(formData, {
      onSuccess: () => {
        toast.success('Media uploaded successfully!');
        setSelectedFile(null);
        setIs360(false);
        setMediaType('image');
        setAutoPlay360(true);
        setUploading(false);
        // Clear input file
        document.getElementById('gallery-upload-input').value = '';
        refetch();
      },
      onError: () => {
        toast.error('Upload failed. Check file type and size.');
        setUploading(false);
      },
    });
  };

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: 'Delete Image?',
      message: 'Are you sure you want to delete this image from the gallery?',
      confirmText: 'Delete Image',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (isConfirmed) {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          toast.success('Image deleted');
          refetch();
        },
        onError: () => toast.error('Deletion failed'),
      });
    }
  };

  const handleMove = async (index, direction) => {
    if (!images) return;
    const newImages = [...images];
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= newImages.length) return;

    // Swap order property
    const tempOrder = newImages[index].order;
    newImages[index].order = newImages[targetIndex].order;
    newImages[targetIndex].order = tempOrder;

    const reorderPayload = [
      { id: newImages[index]._id, order: newImages[index].order },
      { id: newImages[targetIndex]._id, order: newImages[targetIndex].order },
    ];

    reorderMutation.mutate(reorderPayload, {
      onSuccess: () => {
        toast.success('Order updated');
        refetch();
      },
      onError: () => toast.error('Reordering failed'),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left animate-fade-in">
      {/* Upload image card */}
      <div className="lg:col-span-4 glass-card p-6 rounded-3xl shadow-sm space-y-4">
        <form onSubmit={handleUpload}>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-650" />
              Upload Media
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Add new photos or videos to the public gallery.</p>
          </div>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-zinc-250 dark:border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center bg-zinc-55/10 dark:bg-zinc-900/10">
              <Upload className="w-8 h-8 text-zinc-400" />
              <div className="text-[11px] text-zinc-500 font-semibold">
                Choose JPG, PNG, WEBP or MP4 (Max 5MB)
              </div>
              <input
                id="gallery-upload-input"
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="text-xs text-zinc-550 w-full cursor-pointer"
              />
            </div>
            
            <div className="space-y-3 pt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Media Type</label>
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                  className="w-full text-sm rounded-xl border border-zinc-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-650 font-semibold text-zinc-800 dark:text-zinc-200"
                >
                  <option value="image">Image (Photo)</option>
                  <option value="video">Video (MP4/WebM)</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-900 pt-3">
                <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-350 cursor-pointer select-none flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={is360}
                    onChange={(e) => setIs360(e.target.checked)}
                    className="rounded border-zinc-350 text-purple-650 focus:ring-purple-650 w-4 h-4 cursor-pointer"
                  />
                  Is 360° Media?
                </label>
              </div>

              {is360 && (
                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-900 pt-3">
                  <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-355 cursor-pointer select-none flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoPlay360}
                      onChange={(e) => setAutoPlay360(e.target.checked)}
                      className="rounded border-zinc-350 text-purple-650 focus:ring-purple-650 w-4 h-4 cursor-pointer"
                    />
                    Auto Rotate / Auto Play?
                  </label>
                </div>
              )}
            </div>
            <Button
              type="submit"
              disabled={uploading || !selectedFile}
              className="w-full font-bold shadow-md"
            >
              {uploading ? 'Uploading...' : 'Upload Media'}
            </Button>
          </div>
        </form>
      </div>

      {/* Images List Grid */}
      <div className="lg:col-span-8 glass-card rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-xl font-bold text-zinc-850 dark:text-zinc-200">Gallery Management</h3>
          <p className="text-xs text-zinc-450 mt-1">Reorder or delete photos from the display.</p>
        </div>
        <div className="p-6">
          {isLoading ? (
            <Loader size="medium" className="py-12" />
          ) : !images || images.length === 0 ? (
            <p className="text-zinc-400 py-6 text-center font-semibold border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              No gallery images. Upload one.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {images.map((img, idx) => (
                <div
                  key={img._id}
                  className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm hover-glow"
                >
                  {img.is360 && (
                    <span className="absolute top-2 left-2 bg-purple-650 text-white font-extrabold text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full z-10 shadow">
                      360° {img.mediaType}
                    </span>
                  )}
                  {img.mediaType === 'video' ? (
                    <video
                      src={img.imageUrl}
                      muted
                      className="w-full h-40 object-cover border-b border-zinc-200 dark:border-zinc-800"
                    />
                  ) : (
                    <img
                      src={img.imageUrl}
                      alt="Gallery item"
                      className="w-full h-40 object-cover border-b border-zinc-200 dark:border-zinc-800"
                    />
                  )}
                  <div className="p-4 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-400">Order: {img.order}</span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMove(idx, -1)}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-purple-650 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMove(idx, 1)}
                        disabled={idx === images.length - 1}
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-purple-650 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(img._id)}
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-red-555 cursor-pointer"
                        title="Delete photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
