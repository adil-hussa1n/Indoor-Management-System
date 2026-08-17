import React, { useState, useEffect, useMemo } from 'react';
import API from '../services/api';
import { usePublicGrounds } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { Dialog } from '../components/ui/Dialog';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  Tag,
  Calendar,
  CreditCard,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  FileText,
  RefreshCw,
  Globe,
} from 'lucide-react';

export const AdminFinances = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: grounds } = usePublicGrounds();

  const [activeTab, setActiveTab] = useState('entries'); // 'entries' | 'categories'
  const [loading, setLoading] = useState(true);

  // Data states
  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'investment' | 'expense'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [groundFilter, setGroundFilter] = useState('all'); // 'all' | 'general' | groundId
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Category Modal States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState('expense');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // Entry Modal States
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryType, setEntryType] = useState('expense');
  const [entryCategoryId, setEntryCategoryId] = useState('');
  const [entryGroundId, setEntryGroundId] = useState(''); // '' means General / All Arenas
  const [entryTitle, setEntryTitle] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryPaymentMethod, setEntryPaymentMethod] = useState('Cash');
  const [entryReferenceNo, setEntryReferenceNo] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (groundFilter !== 'all') params.groundId = groundFilter;

      const [catsRes, entriesRes, sumRes] = await Promise.all([
        API.get('/finances/categories'),
        API.get('/finances/entries', { params }),
        API.get('/finances/summary', { params }),
      ]);

      if (catsRes.data.success) setCategories(catsRes.data.categories);
      if (entriesRes.data.success) setEntries(entriesRes.data.entries);
      if (sumRes.data.success) setSummary(sumRes.data.summary);
    } catch (err) {
      toast.error('Failed to load financial data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groundFilter]);

  // Category Modal Handlers
  const openCategoryModal = (cat = null, defaultType = 'expense') => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryName(cat.name);
      setCategoryType(cat.type);
      setCategoryDescription(cat.description || '');
    } else {
      setEditingCategory(null);
      setCategoryName('');
      setCategoryType(defaultType);
      setCategoryDescription('');
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      toast.error('Category name is required.');
      return;
    }

    setSavingCategory(true);
    try {
      const payload = {
        name: categoryName.trim(),
        type: categoryType,
        description: categoryDescription.trim() || null,
      };

      if (editingCategory) {
        await API.patch(`/finances/categories/${editingCategory.id}`, payload);
        toast.success(`Category "${categoryName}" updated.`);
      } else {
        await API.post('/finances/categories', payload);
        toast.success(`New ${categoryType} category "${categoryName}" created.`);
      }

      setIsCategoryModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save category.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    const isConfirmed = await confirm({
      title: 'Delete Category?',
      message: `Are you sure you want to delete category "${cat.name}"? This action cannot be undone.`,
      confirmText: 'Delete Category',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (isConfirmed) {
      try {
        await API.delete(`/finances/categories/${cat.id}`);
        toast.success(`Category "${cat.name}" deleted.`);
        fetchData();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete category.');
      }
    }
  };

  // Entry Modal Handlers
  const openEntryModal = (entry = null, defaultType = 'expense') => {
    const targetType = entry ? entry.type : defaultType;
    const availableCats = categories.filter((c) => c.type === targetType);

    if (entry) {
      setEditingEntry(entry);
      setEntryType(entry.type);
      setEntryCategoryId(entry.categoryId.toString());
      setEntryGroundId(entry.groundId ? entry.groundId.toString() : '');
      setEntryTitle(entry.title);
      setEntryAmount(entry.amount.toString());
      setEntryDate(entry.date);
      setEntryPaymentMethod(entry.paymentMethod || 'Cash');
      setEntryReferenceNo(entry.referenceNo || '');
      setEntryDescription(entry.description || '');
    } else {
      setEditingEntry(null);
      setEntryType(defaultType);
      setEntryCategoryId(availableCats.length > 0 ? availableCats[0].id.toString() : '');
      setEntryGroundId('');
      setEntryTitle('');
      setEntryAmount('');
      setEntryDate(new Date().toISOString().split('T')[0]);
      setEntryPaymentMethod('Cash');
      setEntryReferenceNo('');
      setEntryDescription('');
    }
    setIsEntryModalOpen(true);
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!entryCategoryId) {
      toast.error('Please select or create a category first.');
      return;
    }
    if (!entryTitle.trim()) {
      toast.error('Title is required.');
      return;
    }
    if (!entryAmount || Number(entryAmount) <= 0) {
      toast.error('Please enter a valid positive amount.');
      return;
    }

    setSavingEntry(true);
    try {
      const payload = {
        type: entryType,
        categoryId: Number(entryCategoryId),
        groundId: entryGroundId ? Number(entryGroundId) : null,
        title: entryTitle.trim(),
        amount: Number(entryAmount),
        date: entryDate,
        paymentMethod: entryPaymentMethod,
        referenceNo: entryReferenceNo.trim() || null,
        description: entryDescription.trim() || null,
      };

      if (editingEntry) {
        await API.patch(`/finances/entries/${editingEntry.id}`, payload);
        toast.success(`Financial entry updated successfully.`);
      } else {
        await API.post('/finances/entries', payload);
        toast.success(`Recorded new ${entryType} of ৳${Number(entryAmount).toLocaleString()}.`);
      }

      setIsEntryModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save entry.');
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDeleteEntry = async (entry) => {
    const isConfirmed = await confirm({
      title: `Delete ${entry.type === 'investment' ? 'Investment' : 'Expense'} Record?`,
      message: `Are you sure you want to delete "${entry.title}" (৳${Number(entry.amount).toLocaleString()})?`,
      confirmText: 'Delete Entry',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (isConfirmed) {
      try {
        await API.delete(`/finances/entries/${entry.id}`);
        toast.success(`Record deleted successfully.`);
        fetchData();
      } catch (err) {
        toast.error('Failed to delete entry.');
      }
    }
  };

  // Filtered categories for entry modal depending on chosen entryType
  const modalCategories = useMemo(() => {
    return categories.filter((c) => c.type === entryType);
  }, [categories, entryType]);

  // Filtered entries table list
  const filteredEntries = useMemo(() => {
    return entries.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && item.categoryId.toString() !== categoryFilter) return false;
      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(q);
        const refMatch = item.referenceNo?.toLowerCase().includes(q);
        const catMatch = item.category?.name?.toLowerCase().includes(q);
        const groundMatch = item.ground?.name?.toLowerCase().includes(q);
        const descMatch = item.description?.toLowerCase().includes(q);
        if (!titleMatch && !refMatch && !catMatch && !groundMatch && !descMatch) return false;
      }
      return true;
    });
  }, [entries, typeFilter, categoryFilter, startDate, endDate, searchQuery]);

  // Calculated Metrics
  const calculatedTotals = useMemo(() => {
    let totalInv = 0;
    let totalExp = 0;
    entries.forEach((e) => {
      const amt = Number(e.amount) || 0;
      if (e.type === 'investment') totalInv += amt;
      if (e.type === 'expense') totalExp += amt;
    });
    const rev = summary?.totalBookingRevenue || 0;
    return {
      totalInvestments: totalInv,
      totalExpenses: totalExp,
      netBalance: totalInv - totalExp,
      netOperatingProfit: rev + totalInv - totalExp,
      bookingRevenue: rev,
    };
  }, [entries, summary]);

  const investmentCategories = useMemo(() => categories.filter((c) => c.type === 'investment'), [categories]);
  const expenseCategories = useMemo(() => categories.filter((c) => c.type === 'expense'), [categories]);

  if (loading && categories.length === 0 && entries.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-left pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <DollarSign className="w-6 h-6" />
            </span>
            Investments & Expenses
          </h1>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">
            Manage category definitions, log arena-wise or general venue investments and operational expenses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => openCategoryModal(null, 'expense')}
            variant="secondary"
            className="text-xs font-bold flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4 text-purple-500" />
            + Category
          </Button>

          <Button
            onClick={() => openEntryModal(null, 'investment')}
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
          >
            <TrendingUp className="w-4 h-4" />
            + Investment Entry
          </Button>

          <Button
            onClick={() => openEntryModal(null, 'expense')}
            className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 flex items-center gap-1.5"
          >
            <TrendingDown className="w-4 h-4" />
            + Expense Entry
          </Button>
        </div>
      </div>

      {/* Arena Scope Filter Selector */}
      {grounds && grounds.length > 0 && (
        <Card className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-purple-650 dark:text-purple-400 flex items-center gap-1.5 mr-2">
              <Layers className="w-4 h-4" /> Arena Scope:
            </span>

            <button
              onClick={() => setGroundFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                groundFilter === 'all'
                  ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-purple-300'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> All Arenas & General
            </button>

            <button
              onClick={() => setGroundFilter('general')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                groundFilter === 'general'
                  ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-purple-300'
              }`}
            >
              🌐 General Venue Only
            </button>

            {grounds.map((g) => (
              <button
                key={g.id}
                onClick={() => setGroundFilter(g.id.toString())}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                  groundFilter === g.id.toString()
                    ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-purple-300'
                }`}
              >
                <span>🏟️ {g.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 uppercase font-mono">
                  {g.sport}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Investments */}
        <Card className="bg-gradient-to-br from-emerald-500/5 via-emerald-500/10 to-transparent border-emerald-500/20 shadow-sm relative overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Total Investments
              </p>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1 font-mono">
                ৳ {calculatedTotals.totalInvestments.toLocaleString()}
              </h3>
              <p className="text-[10px] text-zinc-400 mt-1 font-medium flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-emerald-500" /> Capital & Infrastructure
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card className="bg-gradient-to-br from-rose-500/5 via-rose-500/10 to-transparent border-rose-500/20 shadow-sm relative overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Total Expenses
              </p>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1 font-mono">
                ৳ {calculatedTotals.totalExpenses.toLocaleString()}
              </h3>
              <p className="text-[10px] text-zinc-400 mt-1 font-medium flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3 text-rose-500" /> Maintenance & Utilities
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <TrendingDown className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Net Financial Balance */}
        <Card className="bg-gradient-to-br from-purple-500/5 via-indigo-500/10 to-transparent border-purple-500/20 shadow-sm relative overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Net Finance Cashflow
              </p>
              <h3 className={`text-2xl font-black mt-1 font-mono ${
                calculatedTotals.netBalance >= 0 ? 'text-zinc-900 dark:text-white' : 'text-rose-500'
              }`}>
                ৳ {calculatedTotals.netBalance.toLocaleString()}
              </h3>
              <p className="text-[10px] text-zinc-400 mt-1 font-medium">
                Investments - Expenses
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <PieChart className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Net Business Operating Profit */}
        <Card className="bg-gradient-to-br from-cyan-500/5 via-blue-500/10 to-transparent border-cyan-500/20 shadow-sm relative overflow-hidden">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                Net Business Profit
              </p>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white mt-1 font-mono">
                ৳ {calculatedTotals.netOperatingProfit.toLocaleString()}
              </h3>
              <p className="text-[10px] text-zinc-400 mt-1 font-medium">
                Revenue (৳{calculatedTotals.bookingRevenue.toLocaleString()}) + Net
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
              <DollarSign className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab('entries')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'entries'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Financial Entries & Transactions ({entries.length})
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'categories'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
          }`}
        >
          <Tag className="w-4 h-4" />
          Manage Categories ({categories.length})
        </button>
      </div>

      {/* TAB 1: ENTRIES LIST */}
      {activeTab === 'entries' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <Card className="bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200/80 dark:border-zinc-800/80 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-center">
              {/* Search */}
              <div className="relative col-span-1 sm:col-span-2">
                <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                <Input
                  placeholder="Search title, arena, ref no, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Type Filter */}
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Entry Types' },
                  { value: 'investment', label: '📈 Investments Only' },
                  { value: 'expense', label: '📉 Expenses Only' },
                ]}
              />

              {/* Category Filter */}
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Categories' },
                  ...categories.map((c) => ({
                    value: c.id.toString(),
                    label: `${c.type === 'investment' ? '📈' : '📉'} ${c.name}`,
                  })),
                ]}
              />

              {/* Reset Filter Button */}
              <Button
                variant="secondary"
                onClick={() => {
                  setTypeFilter('all');
                  setCategoryFilter('all');
                  setGroundFilter('all');
                  setSearchQuery('');
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset Filters
              </Button>
            </div>
          </Card>

          {/* Entries Table */}
          <Card className="overflow-hidden border-zinc-200/80 dark:border-zinc-800">
            {filteredEntries.length === 0 ? (
              <div className="p-12 text-center text-zinc-400 space-y-3">
                <FileText className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700" />
                <p className="text-sm font-semibold">No financial records found matching your filters.</p>
                <div className="flex justify-center gap-2 pt-2">
                  <Button size="sm" onClick={() => openEntryModal(null, 'investment')}>
                    + Log Investment
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openEntryModal(null, 'expense')}>
                    + Log Expense
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Arena / Scope</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Title / Description</th>
                      <th className="py-3.5 px-4">Payment Method</th>
                      <th className="py-3.5 px-4">Ref / Voucher</th>
                      <th className="py-3.5 px-4 text-right">Amount (৳)</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
                    {filteredEntries.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-zinc-700 dark:text-zinc-300">
                          {item.date}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 border ${
                              item.type === 'investment'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {item.type === 'investment' ? (
                              <>
                                <TrendingUp className="w-3 h-3" /> Investment
                              </>
                            ) : (
                              <>
                                <TrendingDown className="w-3 h-3" /> Expense
                              </>
                            )}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {item.ground ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 inline-flex items-center gap-1">
                              🏟️ {item.ground.name}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 inline-flex items-center gap-1">
                              🌐 General Venue
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-zinc-800 dark:text-zinc-200">
                          {item.category?.name || 'Uncategorized'}
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-bold text-zinc-900 dark:text-white">{item.title}</p>
                          {item.description && (
                            <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{item.description}</p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-medium text-zinc-600 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-zinc-400" />
                            {item.paymentMethod || 'Cash'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-zinc-500">
                          {item.referenceNo ? `#${item.referenceNo}` : '—'}
                        </td>

                        <td className={`py-3.5 px-4 text-right font-mono font-black text-sm ${
                          item.type === 'investment' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {item.type === 'investment' ? '+' : '-'}৳ {Number(item.amount).toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openEntryModal(item)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                              title="Edit Record"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(item)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: CATEGORIES MANAGEMENT */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Investment Categories */}
          <Card className="border-emerald-500/20 bg-emerald-500/5 space-y-4">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-emerald-500/10">
              <div>
                <CardTitle className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Investment Categories ({investmentCategories.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Classifications for owner capital, investor funding, and equity.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => openCategoryModal(null, 'investment')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                + Add Investment Cat
              </Button>
            </CardHeader>
            <CardContent className="pt-2">
              {investmentCategories.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-xs">
                  No investment categories created yet. Click "+ Add Investment Cat" to create one.
                </div>
              ) : (
                <div className="divide-y divide-emerald-500/10 text-xs">
                  {investmentCategories.map((cat) => (
                    <div key={cat.id} className="py-3 flex items-center justify-between hover:bg-emerald-500/10 px-2 rounded-xl transition-colors">
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-emerald-500" />
                          {cat.name}
                        </p>
                        {cat.description && <p className="text-[11px] text-zinc-400 mt-0.5">{cat.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openCategoryModal(cat, 'investment')}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-600 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expense Categories */}
          <Card className="border-rose-500/20 bg-rose-500/5 space-y-4">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-rose-500/10">
              <div>
                <CardTitle className="text-base font-extrabold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5" /> Expense Categories ({expenseCategories.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Classifications for turf maintenance, electricity, staff salary, & equipment.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => openCategoryModal(null, 'expense')} className="bg-rose-600 hover:bg-rose-700 text-white text-xs">
                + Add Expense Cat
              </Button>
            </CardHeader>
            <CardContent className="pt-2">
              {expenseCategories.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-xs">
                  No expense categories created yet. Click "+ Add Expense Cat" to create one.
                </div>
              ) : (
                <div className="divide-y divide-rose-500/10 text-xs">
                  {expenseCategories.map((cat) => (
                    <div key={cat.id} className="py-3 flex items-center justify-between hover:bg-rose-500/10 px-2 rounded-xl transition-colors">
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-rose-500" />
                          {cat.name}
                        </p>
                        {cat.description && <p className="text-[11px] text-zinc-400 mt-0.5">{cat.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openCategoryModal(cat, 'expense')}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {isCategoryModalOpen && (
        <Dialog
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          title={editingCategory ? `Edit Category: ${editingCategory.name}` : `Create New ${categoryType === 'investment' ? 'Investment' : 'Expense'} Category`}
          className="max-w-md"
        >
          <form onSubmit={handleSaveCategory} className="space-y-4 pt-4 text-left">
            <Select
              label="Category Type"
              value={categoryType}
              onChange={(e) => setCategoryType(e.target.value)}
              options={[
                { value: 'expense', label: '📉 Expense Category (e.g. Electricity, Maintenance, Salary)' },
                { value: 'investment', label: '📈 Investment Category (e.g. Owner Capital, Partner Funding)' },
              ]}
              disabled={!!editingCategory}
            />

            <Input
              label="Category Name"
              placeholder="e.g. Turf Maintenance, Staff Salary..."
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
            />

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-650 dark:text-zinc-400 uppercase tracking-wider block">
                Description (Optional)
              </label>
              <textarea
                rows="3"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder="Optional notes describing what belongs in this category..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-650"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-150 dark:border-zinc-800">
              <Button type="button" variant="secondary" onClick={() => setIsCategoryModalOpen(false)} disabled={savingCategory}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingCategory}>
                {savingCategory ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ENTRY MODAL */}
      {isEntryModalOpen && (
        <Dialog
          isOpen={isEntryModalOpen}
          onClose={() => setIsEntryModalOpen(false)}
          title={editingEntry ? `Edit Financial Record` : `Log ${entryType === 'investment' ? 'Investment' : 'Expense'} Entry`}
          className="max-w-lg"
        >
          <form onSubmit={handleSaveEntry} className="space-y-4 pt-4 text-left">
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Transaction Type"
                value={entryType}
                onChange={(e) => {
                  const nt = e.target.value;
                  setEntryType(nt);
                  const matching = categories.filter((c) => c.type === nt);
                  setEntryCategoryId(matching.length > 0 ? matching[0].id.toString() : '');
                }}
                options={[
                  { value: 'expense', label: '📉 Expense' },
                  { value: 'investment', label: '📈 Investment' },
                ]}
              />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-650 dark:text-zinc-400 uppercase tracking-wider block">
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEntryModalOpen(false);
                      openCategoryModal(null, entryType);
                    }}
                    className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    + New Category
                  </button>
                </div>
                {modalCategories.length === 0 ? (
                  <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    No {entryType} categories. Click "+ New Category" above first.
                  </div>
                ) : (
                  <Select
                    value={entryCategoryId}
                    onChange={(e) => setEntryCategoryId(e.target.value)}
                    options={modalCategories.map((c) => ({ value: c.id.toString(), label: c.name }))}
                  />
                )}
              </div>
            </div>

            {/* Arena Scope Selection */}
            {grounds && grounds.length > 0 && (
              <Select
                label="Target Arena / Scope"
                value={entryGroundId}
                onChange={(e) => setEntryGroundId(e.target.value)}
                options={[
                  { value: '', label: '🌐 General Venue (All Arenas / Overall Business)' },
                  ...grounds.map((g) => ({
                    value: g.id.toString(),
                    label: `🏟️ ${g.name} (${g.sport})`,
                  })),
                ]}
              />
            )}

            <Input
              label="Title / Summary"
              placeholder={entryType === 'investment' ? 'e.g. Partner Capital Deposit...' : 'e.g. August Electricity Bill...'}
              value={entryTitle}
              onChange={(e) => setEntryTitle(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Amount (৳ BDT)"
                type="number"
                placeholder="e.g. 5000"
                value={entryAmount}
                onChange={(e) => setEntryAmount(e.target.value)}
                required
              />

              <Input
                label="Date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Payment Method"
                value={entryPaymentMethod}
                onChange={(e) => setEntryPaymentMethod(e.target.value)}
                options={[
                  { value: 'Cash', label: '💵 Cash' },
                  { value: 'Bank Transfer', label: '🏦 Bank Transfer' },
                  { value: 'bKash', label: '📱 bKash' },
                  { value: 'POS / Card', label: '💳 POS / Card' },
                  { value: 'Cheque', label: '📜 Cheque' },
                  { value: 'Other', label: '🌐 Other' },
                ]}
              />

              <Input
                label="Ref / Voucher No (Optional)"
                placeholder="e.g. TRX-1092 / VCH-44"
                value={entryReferenceNo}
                onChange={(e) => setEntryReferenceNo(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-650 dark:text-zinc-400 uppercase tracking-wider block">
                Additional Notes / Description
              </label>
              <textarea
                rows="2"
                value={entryDescription}
                onChange={(e) => setEntryDescription(e.target.value)}
                placeholder="Optional detailed description or payee name..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-650"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-150 dark:border-zinc-800">
              <Button type="button" variant="secondary" onClick={() => setIsEntryModalOpen(false)} disabled={savingEntry}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingEntry || modalCategories.length === 0}>
                {savingEntry ? 'Saving Record...' : editingEntry ? 'Save Changes' : `Log ${entryType === 'investment' ? 'Investment' : 'Expense'}`}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};
