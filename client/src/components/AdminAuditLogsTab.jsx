import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { useToast } from '../components/ui/Toast';
import { Search, Download, Shield, Clock, FileText, User, RefreshCw, Layers } from 'lucide-react';
import { Dialog } from '../components/ui/Dialog';

export const AdminAuditLogsTab = () => {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await API.get('/audit-logs', {
        params: { category, search, page, limit: 30 },
      });
      if (res.data.success) {
        setLogs(res.data.logs);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (e) {
      toast.error('Failed to load system audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [category, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPage(1);
    fetchLogs();
  };

  const exportLogsCSV = () => {
    if (!logs || logs.length === 0) {
      toast.error('No audit logs available to export.');
      return;
    }
    const headers = ['Timestamp', 'Admin User', 'Action', 'Category', 'Description', 'IP Address'];
    const rows = logs.map(l => [
      `"${new Date(l.createdAt).toLocaleString()}"`,
      `"${l.adminUsername || 'Admin'}"`,
      `"${l.action || ''}"`,
      `"${l.category || ''}"`,
      `"${l.description ? l.description.replace(/"/g, '""') : ''}"`,
      `"${l.ipAddress || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `system_audit_logs_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit logs exported to CSV file!');
  };

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'settings':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'bookings':
      case 'booking':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'slots':
      case 'slot':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'arenas':
      case 'arena':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'blacklist':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      case 'reviews':
        return 'bg-amber-400/10 text-amber-500 dark:text-amber-300 border-amber-400/20';
      case 'messages':
        return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
      case 'gallery':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      case 'security':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Header Banner */}
      <div className="glass-card p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl border border-purple-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white">
              System Audit Logs & Admin Activity History
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            Complete security audit trail tracking settings changes, booking modifications, and admin actions.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={fetchLogs}
            className="p-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={exportLogsCSV}
            className="px-4 py-2.5 bg-purple-650 text-white font-bold text-xs rounded-2xl hover:bg-purple-700 transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="glass-card p-4 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by action, admin, or summary..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-medium rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-650"
          />
        </form>

        <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Logs' },
            { id: 'settings', label: '⚙️ Settings' },
            { id: 'bookings', label: '🎟️ Bookings' },
            { id: 'slots', label: '⏰ Slots' },
            { id: 'arenas', label: '⚽ Arenas' },
            { id: 'blacklist', label: '🚫 Blacklist' },
            { id: 'reviews', label: '⭐ Reviews' },
            { id: 'messages', label: '💬 Messages' },
            { id: 'gallery', label: '🖼️ Gallery' },
            { id: 'security', label: '🔒 Security' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setCategory(cat.id);
                setPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-xl font-bold transition-colors whitespace-nowrap cursor-pointer ${
                category === cat.id
                  ? 'bg-purple-650 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-card rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-purple-650 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-zinc-400 font-semibold text-sm">
            No system audit logs found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Admin User</th>
                  <th className="py-3 px-4">Category & Action</th>
                  <th className="py-3 px-4">Log Summary</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-zinc-200 dark:divide-zinc-800/60 font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4 font-bold">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                        <User className="w-3 h-3" />
                        {log.adminUsername || 'Admin'}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase border ${getCategoryColor(log.category)}`}>
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-zinc-800 dark:text-zinc-200 font-semibold max-w-md truncate">
                      {log.description || 'System action executed'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {(log.newValue || log.oldValue) ? (
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-900 text-purple-650 dark:text-purple-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors cursor-pointer"
                        >
                          View Diff
                        </button>
                      ) : (
                        <span className="text-zinc-400 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <Dialog
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Log Details: ${selectedLog.action}`}
          className="max-w-lg"
        >
          <div className="space-y-4 pt-4 text-left font-mono text-xs">
            <div className="p-3 bg-zinc-100 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-1">
              <p className="text-zinc-500">Log Description:</p>
              <p className="font-bold text-zinc-900 dark:text-white font-sans text-sm">{selectedLog.description}</p>
            </div>

            {selectedLog.oldValue && (
              <div className="space-y-1">
                <p className="text-zinc-400 font-bold text-[11px] font-sans">Previous Value (Before Change):</p>
                <pre className="p-3 bg-zinc-900 text-rose-300 rounded-2xl overflow-x-auto max-h-40 text-[11px]">
                  {JSON.stringify(selectedLog.oldValue, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.newValue && (
              <div className="space-y-1">
                <p className="text-zinc-400 font-bold text-[11px] font-sans">New Value (After Change):</p>
                <pre className="p-3 bg-zinc-900 text-emerald-300 rounded-2xl overflow-x-auto max-h-40 text-[11px]">
                  {JSON.stringify(selectedLog.newValue, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
};
