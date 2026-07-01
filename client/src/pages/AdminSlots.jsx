import React, { useState } from 'react';
import { useAdminSlots, useCreateSlot, useUpdateSlot, useDeleteSlot } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { Trash2, ToggleLeft, ToggleRight, Plus, Calendar, Clock, Sparkles } from 'lucide-react';

const WEEKDAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

export const AdminSlots = () => {
  const toast = useToast();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [slotType, setSlotType] = useState('general'); // "general" | "weekly" | "special"
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [specificDate, setSpecificDate] = useState('');
  const [activeTab, setActiveTab] = useState('general'); // "general" | "weekly" | "special"

  const { data: slots, isLoading, refetch } = useAdminSlots();
  const createSlotMutation = useCreateSlot();
  const updateSlotMutation = useUpdateSlot();
  const deleteSlotMutation = useDeleteSlot();

  const handleCreate = (e) => {
    e.preventDefault();
    if (!startTime || !endTime) {
      toast.error('Both start and end times are required');
      return;
    }

    if (slotType === 'special' && !specificDate) {
      toast.error('Please specify a date for special slots');
      return;
    }

    const payload = {
      startTime,
      endTime,
      dayOfWeek: slotType === 'weekly' ? Number(dayOfWeek) : -1,
      specificDate: slotType === 'special' ? specificDate : null,
    };

    createSlotMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Time slot created successfully!');
        setStartTime('');
        setEndTime('');
        setSpecificDate('');
        refetch();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Slot collision detected.');
      },
    });
  };

  const handleToggle = (id, currentStatus) => {
    updateSlotMutation.mutate(
      { id, data: { isActive: !currentStatus } },
      {
        onSuccess: () => {
          toast.success('Slot status updated');
          refetch();
        },
        onError: () => toast.error('Failed to update status'),
      }
    );
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this time slot? Existing bookings will not be affected.')) {
      deleteSlotMutation.mutate(id, {
        onSuccess: () => {
          toast.success('Slot deleted');
          refetch();
        },
        onError: () => toast.error('Deletion failed'),
      });
    }
  };

  // Filter slots for listing based on activeTab
  const getFilteredSlots = () => {
    if (!slots) return [];
    if (activeTab === 'general') {
      return slots.filter((s) => s.dayOfWeek === -1 && !s.specificDate);
    }
    if (activeTab === 'weekly') {
      return slots.filter((s) => s.dayOfWeek !== -1 && !s.specificDate);
    }
    if (activeTab === 'special') {
      return slots.filter((s) => s.specificDate);
    }
    return [];
  };

  const filteredSlots = getFilteredSlots();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left">
      {/* Create Slot Card */}
      <Card className="lg:col-span-4">
        <form onSubmit={handleCreate}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-650" />
              Add Time Slot
            </CardTitle>
            <CardDescription>Create daily default, weekly, or special override slots.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Slot Classification Type"
              value={slotType}
              onChange={(e) => setSlotType(e.target.value)}
              placeholder=""
              options={[
                { value: 'general', label: 'General Default (Daily)' },
                { value: 'weekly', label: 'Week-Wise Day Slot' },
                { value: 'special', label: 'Special Override Date' },
              ]}
            />

            {slotType === 'weekly' && (
              <Select
                label="Select Day of the Week"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                placeholder=""
                options={WEEKDAYS}
              />
            )}

            {slotType === 'special' && (
              <Input
                label="Target Special Date"
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Time (HH:MM)"
                placeholder="e.g. 08:00"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <Input
                label="End Time (HH:MM)"
                placeholder="e.g. 09:00"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={createSlotMutation.isPending}
              className="w-full mt-2"
            >
              {createSlotMutation.isPending ? 'Creating...' : 'Create Time Slot'}
            </Button>
          </CardContent>
        </form>
      </Card>

      {/* Slots List Card */}
      <Card className="lg:col-span-8">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Daily Scheduling Slots</CardTitle>
            <CardDescription>Manage active slots shown on the public calendar.</CardDescription>
          </div>
        </CardHeader>
        
        {/* Navigation Tabs */}
        <div className="px-6 border-b border-zinc-150 dark:border-zinc-800 flex gap-2">
          {[
            { id: 'general', label: 'General Daily', icon: <Clock className="w-4 h-4" /> },
            { id: 'weekly', label: 'Weekly Days', icon: <Calendar className="w-4 h-4" /> },
            { id: 'special', label: 'Special Override Dates', icon: <Sparkles className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 border-b-2 text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <CardContent className="pt-6">
          {isLoading ? (
            <Loader size="medium" className="py-12" />
          ) : filteredSlots.length === 0 ? (
            <p className="text-zinc-400 py-12 text-center font-semibold border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              No time slots created under this category.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredSlots.map((slot) => {
                // Determine display label for specific date or week days
                let dayLabel = '';
                if (slot.dayOfWeek !== -1) {
                  dayLabel = WEEKDAYS.find((d) => d.value === String(slot.dayOfWeek))?.label || '';
                } else if (slot.specificDate) {
                  dayLabel = `Special Date: ${slot.specificDate}`;
                } else {
                  dayLabel = 'Default Daily';
                }

                return (
                  <div
                    key={slot._id}
                    className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                      slot.isActive
                        ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm'
                        : 'border-zinc-150 bg-zinc-50/50 text-zinc-400 dark:bg-zinc-900/10'
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="font-extrabold text-md text-zinc-900 dark:text-zinc-200">
                        {slot.startTime} - {slot.endTime}
                      </span>
                      <div className="text-xs font-semibold text-purple-650">
                        Category: {dayLabel}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-semibold">
                        Status: {slot.isActive ? 'Active' : 'Disabled'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggle(slot._id, slot.isActive)}
                        className="p-1 text-zinc-400 hover:text-purple-650 transition-colors"
                        title={slot.isActive ? 'Disable slot' : 'Enable slot'}
                      >
                        {slot.isActive ? (
                          <ToggleRight className="w-8 h-8 text-purple-600" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-zinc-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(slot._id)}
                        className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                        title="Delete slot"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
