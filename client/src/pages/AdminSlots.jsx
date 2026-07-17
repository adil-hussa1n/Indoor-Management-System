import React, { useState } from 'react';
import { useAdminSlots, useCreateSlot, useUpdateSlot, useDeleteSlot } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { DatePicker } from '../components/ui/DatePicker';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
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

const timeOptions = [];
for (let hour = 0; hour < 24; hour++) {
  for (let min of ['00', '30']) {
    const h24 = String(hour).padStart(2, '0');
    const time24 = `${h24}:${min}`;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    let displayHour = hour % 12;
    displayHour = displayHour ? displayHour : 12;
    const displayHourStr = String(displayHour).padStart(2, '0');
    const label = `${displayHourStr}:${min} ${ampm}`;
    timeOptions.push({ value: time24, label });
  }
}

// Add 24:00 (Midnight) as last option to allow full day-end slots
timeOptions.push({ value: '24:00', label: '12:00 AM (Midnight)' });

const format12Hour = (time24) => {
  if (!time24) return '';
  if (time24 === '24:00') return '12:00 AM';
  const [hourStr, minStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  const displayHour = String(hour).padStart(2, '0');
  return `${displayHour}:${minStr} ${ampm}`;
};

const formatDateDMY = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const AdminSlots = () => {
  const toast = useToast();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [slotType, setSlotType] = useState('general'); // "general" | "weekly" | "special"
  const [dayOfWeek, setDayOfWeek] = useState('0');
  const [specificDate, setSpecificDate] = useState('');
  const [rateType, setRateType] = useState('day');
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
      rateType,
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

  const confirm = useConfirm();

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: 'Delete Time Slot?',
      message: 'Are you sure you want to delete this time slot? Existing bookings will not be affected.',
      confirmText: 'Delete Slot',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (isConfirmed) {
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left animate-fade-in">
      {/* Create slot card */}
      <div className="lg:col-span-4 glass-card p-6 rounded-3xl shadow-sm space-y-4">
        <form onSubmit={handleCreate}>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-650" />
              Add Time Slot
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Configure slot type, timings and rates.</p>
          </div>
          <div className="space-y-4">
            <Select
              label="Slot Classification"
              value={slotType}
              onChange={(e) => setSlotType(e.target.value)}
              placeholder=""
              options={[
                { value: 'general', label: 'General Default Daily' },
                { value: 'weekly', label: 'Weekly Schedule Day' },
                { value: 'special', label: 'Special Date Override' },
              ]}
            />

            {slotType === 'weekly' && (
              <Select
                label="Target Weekday"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                placeholder=""
                options={WEEKDAYS}
              />
            )}

            {slotType === 'special' && (
              <DatePicker
                label="Target Special Date"
                value={specificDate}
                onChange={setSpecificDate}
              />
            )}

             <div className="grid grid-cols-2 gap-4">
               <Select
                 label="Start Time"
                 value={startTime}
                 onChange={(e) => setStartTime(e.target.value)}
                 options={timeOptions}
                 placeholder="Select start"
               />
               <Select
                 label="End Time"
                 value={endTime}
                 onChange={(e) => setEndTime(e.target.value)}
                 options={timeOptions}
                 placeholder="Select end"
               />
             </div>

            <Select
              label="Shift / Rate Type"
              value={rateType}
              onChange={(e) => setRateType(e.target.value)}
              placeholder=""
              options={[
                { value: 'day', label: 'Day Shift' },
                { value: 'night', label: 'Night Shift' },
              ]}
            />

            <Button
              type="submit"
              disabled={createSlotMutation.isPending}
              className="w-full mt-2 font-bold"
            >
              {createSlotMutation.isPending ? 'Creating...' : 'Create Time Slot'}
            </Button>
          </div>
        </form>
      </div>

      {/* Slots List Card */}
      <div className="lg:col-span-8 glass-card rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-850 dark:text-zinc-200">Daily Scheduling Slots</h3>
            <p className="text-xs text-zinc-450 mt-1">Manage active slots shown on the public calendar.</p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="px-6 border-b border-zinc-150 dark:border-zinc-800 flex flex-nowrap gap-6 overflow-x-auto custom-scrollbar">
          {[
            { id: 'general', label: 'General Daily', icon: <Clock className="w-4 h-4" /> },
            { id: 'weekly', label: 'Weekly Days', icon: <Calendar className="w-4 h-4" /> },
            { id: 'special', label: 'Special Override Dates', icon: <Sparkles className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 border-b-2 text-sm font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-650 text-purple-650 dark:text-purple-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {isLoading ? (
            <Loader size="medium" className="py-12" />
          ) : filteredSlots.length === 0 ? (
            <p className="text-zinc-400 py-12 text-center font-semibold border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              No time slots created under this category.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredSlots.map((slot) => {
                let dayLabel = '';
                if (slot.dayOfWeek !== -1) {
                  dayLabel = WEEKDAYS.find((d) => d.value === String(slot.dayOfWeek))?.label || '';
                } else if (slot.specificDate) {
                  dayLabel = `Special Date: ${formatDateDMY(slot.specificDate)}`;
                } else {
                  dayLabel = 'Default Daily';
                }

                return (
                  <div
                    key={slot._id}
                    className={`p-4 rounded-xl border flex items-center justify-between transition-all hover-glow ${
                      slot.isActive
                        ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm'
                        : 'border-zinc-150 bg-zinc-50/50 text-zinc-400 dark:bg-zinc-900/10'
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="font-extrabold text-md text-zinc-900 dark:text-zinc-200">
                        {format12Hour(slot.startTime)} - {format12Hour(slot.endTime)}
                      </span>
                      <div className="text-xs font-semibold text-purple-650">
                        Category: {dayLabel} ({slot.rateType === 'night' ? 'Night Shift' : 'Day Shift'})
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
        </div>
      </div>
    </div>
  );
};
