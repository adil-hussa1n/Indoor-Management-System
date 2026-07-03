import React from 'react';
import { useAdminReviews, useUpdateReviewStatus, useDeleteReview } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { Star, CheckCircle, Trash2, ShieldAlert, Heart } from 'lucide-react';

export const AdminReviews = () => {
  const toast = useToast();
  const { data: reviews, isLoading, refetch } = useAdminReviews();
  const updateStatusMutation = useUpdateReviewStatus();
  const deleteReviewMutation = useDeleteReview();

  const handleApprove = (id, currentApproval) => {
    updateStatusMutation.mutate(
      { id, data: { isApproved: !currentApproval } },
      {
        onSuccess: () => {
          toast.success(currentApproval ? 'Review unapproved' : 'Review approved and published');
          refetch();
        },
        onError: () => toast.error('Failed to update review status'),
      }
    );
  };

  const handleFeature = (id, currentFeatured) => {
    updateStatusMutation.mutate(
      { id, data: { isFeatured: !currentFeatured } },
      {
        onSuccess: () => {
          toast.success(currentFeatured ? 'Removed from featured' : 'Added to featured homepage slider');
          refetch();
        },
        onError: () => toast.error('Failed to update featured status'),
      }
    );
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this review permanently?')) {
      deleteReviewMutation.mutate(id, {
        onSuccess: () => {
          toast.success('Review deleted');
          refetch();
        },
        onError: () => toast.error('Deletion failed'),
      });
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Customer Reviews & Feedback</h3>
          <p className="text-xs text-zinc-400 mt-1">Approve or feature reviews submitted by players.</p>
        </div>
        <div>
          {isLoading ? (
            <Loader size="medium" className="py-12" />
          ) : !reviews || reviews.length === 0 ? (
            <p className="text-zinc-400 py-6 text-center font-semibold">No customer reviews submitted yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reviews.map((rev) => (
                <div
                  key={rev._id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all hover-glow ${
                    rev.isApproved
                      ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm'
                      : 'border-amber-250/50 bg-amber-50/5 dark:bg-amber-950/5 shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < rev.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-zinc-200 dark:text-zinc-800'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-zinc-400">
                        {new Date(rev.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>

                    <p className="text-sm text-zinc-650 dark:text-zinc-350 italic mb-4">
                      "{rev.comment}"
                    </p>
                    <div className="font-extrabold text-xs uppercase tracking-wider text-purple-650 dark:text-purple-400">
                      - {rev.customerName}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-900 pt-4 mt-2">
                    <div className="flex gap-2">
                      <Button
                        size="small"
                        variant={rev.isApproved ? 'secondary' : 'primary'}
                        onClick={() => handleApprove(rev._id, rev.isApproved)}
                        className="py-1 px-3 text-xs font-bold"
                      >
                        {rev.isApproved ? 'Unapprove' : 'Approve'}
                      </Button>
                      <button
                        onClick={() => handleFeature(rev._id, rev.isFeatured)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          rev.isFeatured
                            ? 'border-pink-200 bg-pink-50 text-pink-600 dark:border-pink-950/50 dark:bg-pink-950/20'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-pink-550'
                        }`}
                        title={rev.isFeatured ? 'Remove featured' : 'Feature review'}
                      >
                        <Heart className={`w-4 h-4 ${rev.isFeatured ? 'fill-pink-550' : ''}`} />
                      </button>
                    </div>

                    <button
                      onClick={() => handleDelete(rev._id)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                      title="Delete review"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
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
