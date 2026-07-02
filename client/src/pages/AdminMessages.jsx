import React from 'react';
import { useAdminMessages, useUpdateMessageStatus, useDeleteMessage } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { MailOpen, Mail, Trash2, CheckCheck } from 'lucide-react';

export const AdminMessages = () => {
  const toast = useToast();
  const { data: messages, isLoading, refetch } = useAdminMessages();
  const updateStatusMutation = useUpdateMessageStatus();
  const deleteMessageMutation = useDeleteMessage();

  const handleToggleRead = (id, currentRead) => {
    updateStatusMutation.mutate(
      { id, data: { isRead: !currentRead } },
      {
        onSuccess: () => {
          toast.success(currentRead ? 'Marked as unread' : 'Marked as read');
          refetch();
        },
        onError: () => toast.error('Failed to update status'),
      }
    );
  };

  const handleReplyStatus = (id, currentStatus) => {
    const nextStatus = currentStatus === 'Replied' ? 'Pending' : 'Replied';
    updateStatusMutation.mutate(
      { id, data: { replyStatus: nextStatus } },
      {
        onSuccess: () => {
          toast.success(`Reply status updated to: ${nextStatus}`);
          refetch();
        },
        onError: () => toast.error('Failed to update status'),
      }
    );
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this message permanently?')) {
      deleteMessageMutation.mutate(id, {
        onSuccess: () => {
          toast.success('Message deleted');
          refetch();
        },
        onError: () => toast.error('Failed to delete message'),
      });
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Contact Inbox</h3>
          <p className="text-xs text-zinc-400 mt-1">View and manage inquiries sent from the website contact sheet.</p>
        </div>
        <div>
          {isLoading ? (
            <Loader size="medium" className="py-12" />
          ) : !messages || messages.length === 0 ? (
            <p className="text-zinc-400 py-6 text-center font-semibold">Inbox is empty.</p>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover-glow ${
                    msg.isRead
                      ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm'
                      : 'border-purple-250/50 bg-purple-50/5 dark:bg-purple-950/5 shadow-sm'
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${msg.isRead ? 'bg-zinc-300 dark:bg-zinc-700' : 'bg-purple-600 animate-pulse'}`} />
                      <h4 className="font-bold text-base text-zinc-900 dark:text-white">
                        {msg.name}
                      </h4>
                      <span className="text-xs text-zinc-450 font-medium">
                        ({new Date(msg.createdAt).toLocaleString()})
                      </span>
                    </div>

                    <div className="text-xs text-zinc-550 space-y-0.5 font-semibold">
                      <div>Email: <a href={`mailto:${msg.email}`} className="text-purple-650 hover:underline">{msg.email}</a></div>
                      {msg.phone && <div>Phone: {msg.phone}</div>}
                    </div>

                    <p className="text-sm text-zinc-650 dark:text-zinc-350 leading-relaxed pt-1 font-medium">
                      {msg.message}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 border-t md:border-t-0 border-zinc-100 dark:border-zinc-900 pt-3 md:pt-0">
                    <button
                      onClick={() => handleToggleRead(msg._id, msg.isRead)}
                      className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                        msg.isRead
                          ? 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-600'
                          : 'border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-950 dark:bg-purple-950/30'
                      }`}
                      title={msg.isRead ? 'Mark as unread' : 'Mark as read'}
                    >
                      {msg.isRead ? <MailOpen className="w-4.5 h-4.5" /> : <Mail className="w-4.5 h-4.5" />}
                    </button>

                    <Button
                      size="small"
                      variant={msg.replyStatus === 'Replied' ? 'secondary' : 'outline'}
                      onClick={() => handleReplyStatus(msg._id, msg.replyStatus)}
                      className="py-1.5 px-3 text-xs font-bold"
                    >
                      {msg.replyStatus === 'Replied' ? '✓ Replied' : 'Mark Replied'}
                    </Button>

                    <button
                      onClick={() => handleDelete(msg._id)}
                      className="p-2 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                      title="Delete inquiry"
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
