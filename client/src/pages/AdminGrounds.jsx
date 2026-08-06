import React, { useState } from 'react';
import { useGrounds, useCreateGround, useUpdateGround, useDeleteGround, useReorderGrounds, useAdminSettings } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Layout, Dumbbell, ArrowUp, ArrowDown } from 'lucide-react';
import { Dialog } from '../components/ui/Dialog';

export const AdminGrounds = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const { data: grounds, isLoading: groundsLoading, refetch } = useGrounds();
  const { data: settings } = useAdminSettings();
  
  const createGroundMutation = useCreateGround();
  const updateGroundMutation = useUpdateGround();
  const deleteGroundMutation = useDeleteGround();
  const reorderGroundsMutation = useReorderGrounds();

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newGrounds = [...grounds];
    const temp = newGrounds[index];
    newGrounds[index] = newGrounds[index - 1];
    newGrounds[index - 1] = temp;
    const newIds = newGrounds.map((g) => g.id);
    reorderGroundsMutation.mutate(newIds, {
      onSuccess: () => {
        toast.success('Arena order updated!');
        refetch();
      },
    });
  };

  const handleMoveDown = (index) => {
    if (index === grounds.length - 1) return;
    const newGrounds = [...grounds];
    const temp = newGrounds[index];
    newGrounds[index] = newGrounds[index + 1];
    newGrounds[index + 1] = temp;
    const newIds = newGrounds.map((g) => g.id);
    reorderGroundsMutation.mutate(newIds, {
      onSuccess: () => {
        toast.success('Arena order updated!');
        refetch();
      },
    });
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [sport, setSport] = useState('Football');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Edit state
  const [editingGround, setEditingGround] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSport, setEditSport] = useState('Football');
  const [editDescription, setEditDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const sportsOptions = settings?.availableSports?.map(s => ({ value: s, label: s })) || [
    { value: 'Football', label: 'Football' },
    { value: 'Cricket', label: 'Cricket' },
    { value: 'Badminton', label: 'Badminton' },
  ];

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Arena name is required');
      return;
    }

    createGroundMutation.mutate(
      { name, sport, description, isActive },
      {
        onSuccess: () => {
          toast.success('New arena/ground created successfully!');
          setName('');
          setSport(sportsOptions[0]?.value || 'Football');
          setDescription('');
          setIsActive(true);
          setIsModalOpen(false);
          refetch();
        },
        onError: (err) => {
          toast.error(err.response?.data?.message || 'Failed to create arena.');
        },
      }
    );
  };

  const handleEditOpen = (ground) => {
    setEditingGround(ground);
    setEditName(ground.name);
    setEditSport(ground.sport);
    setEditDescription(ground.description || '');
    setEditIsActive(ground.isActive);
    setIsEditModalOpen(true);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      toast.error('Arena name is required');
      return;
    }

    updateGroundMutation.mutate(
      {
        id: editingGround.id,
        data: {
          name: editName,
          sport: editSport,
          description: editDescription,
          isActive: editIsActive,
        },
      },
      {
        onSuccess: () => {
          toast.success('Arena/ground updated successfully.');
          setIsEditModalOpen(false);
          setEditingGround(null);
          refetch();
        },
        onError: (err) => {
          toast.error(err.response?.data?.message || 'Failed to update arena.');
        },
      }
    );
  };

  const handleToggleActive = (ground) => {
    updateGroundMutation.mutate(
      {
        id: ground.id,
        data: { isActive: !ground.isActive },
      },
      {
        onSuccess: () => {
          toast.success(`Arena status updated successfully.`);
          refetch();
        },
        onError: (err) => {
          toast.error(err.response?.data?.message || 'Failed to change status.');
        },
      }
    );
  };

  const handleDelete = async (ground) => {
    const isConfirmed = await confirm({
      title: 'Deprovision Arena/Ground?',
      message: `Are you sure you want to permanently delete arena "${ground.name}"? If there are slots or bookings configured, they will need to be cancelled first.`,
      confirmText: 'Delete Arena',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (isConfirmed) {
      deleteGroundMutation.mutate(ground.id, {
        onSuccess: () => {
          toast.success('Arena deleted successfully.');
          refetch();
        },
        onError: (err) => {
          toast.error(err.response?.data?.message || 'Deletion failed. Check if bookings are active.');
        },
      });
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
            <Layout className="w-6 h-6 text-purple-650" />
            Arena / Grounds Configuration
          </h2>
          <p className="text-xs text-zinc-450 mt-1">
            Manage multiple courts, pitches, or playing areas inside your venue.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5 font-bold shadow-lg shadow-purple-500/10 cursor-pointer w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Provision New Arena
        </Button>
      </div>

      {groundsLoading ? (
        <div className="flex justify-center py-20"><Loader size="lg" /></div>
      ) : !grounds || grounds.length === 0 ? (
        <Card className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md">
          <p className="text-zinc-500 font-semibold mb-4">No Arenas or Grounds found.</p>
          <Button onClick={() => setIsModalOpen(true)}>Create One Now</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {grounds.map((g, idx) => (
            <Card key={g.id} className="glass-card hover-glow border border-zinc-200/50 dark:border-zinc-850 flex flex-col justify-between overflow-hidden relative">
              <CardHeader className="pb-3 flex flex-row justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-mono">
                      #{idx + 1}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-mono">
                      <Dumbbell className="w-3 h-3" /> {g.sport}
                    </span>
                  </div>
                  <CardTitle className="text-lg font-extrabold text-zinc-900 dark:text-white mt-1.5">
                    {g.name}
                  </CardTitle>
                </div>
                
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  g.isActive
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${g.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {g.isActive ? 'Active' : 'Offline'}
                </span>
              </CardHeader>
              
              <CardContent className="pb-5 pt-0 space-y-4">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed min-h-[40px]">
                  {g.description || <span className="italic text-zinc-400">No description provided.</span>}
                </p>
                
                <div className="flex justify-between items-center pt-3 border-t border-zinc-100 dark:border-zinc-900/60">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(g)}
                      className="p-1 text-zinc-450 hover:text-indigo-650 transition-colors"
                      title={g.isActive ? 'Deactivate Arena' : 'Activate Arena'}
                    >
                      {g.isActive ? <ToggleRight className="w-6 h-6 text-indigo-500" /> : <ToggleLeft className="w-6 h-6 text-zinc-400" />}
                    </button>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                      Status
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Order reorder buttons */}
                    <button
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="p-1.5 text-zinc-500 hover:text-purple-600 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/30"
                      title="Move Up in List"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === grounds.length - 1}
                      className="p-1.5 text-zinc-500 hover:text-purple-600 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/30"
                      title="Move Down in List"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    
                    <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

                    <button
                      onClick={() => handleEditOpen(g)}
                      className="p-2 text-zinc-550 hover:text-indigo-600 transition-colors rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                      title="Edit settings"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(g)}
                      className="p-2 text-zinc-550 hover:text-rose-600 transition-colors rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                      title="Deprovision Arena"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Provision Modal */}
      {isModalOpen && (
        <Dialog
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Provision New Arena / Ground"
          className="max-w-md"
        >
          <form onSubmit={handleCreate} className="space-y-4 pt-4 text-left">
            <Input
              label="Arena Name"
              placeholder="e.g. Football Turf A, Court 3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Select
              label="Associated Sport Type"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              options={sportsOptions}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider block">
                Description / Equipment
              </label>
              <textarea
                className="w-full h-24 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                placeholder="Details about court size, lights, net availability..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800/80">
              <div>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Set Instantly Active</span>
                <span className="text-[10px] text-zinc-450 block">Allow public slot configurations instantly.</span>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className="text-zinc-500 focus:outline-none"
              >
                {isActive ? <ToggleRight className="w-7 h-7 text-indigo-500" /> : <ToggleLeft className="w-7 h-7 text-zinc-400" />}
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-900">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createGroundMutation.isPending}>
                {createGroundMutation.isPending ? 'Provisioning...' : 'Provision Arena'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingGround && (
        <Dialog
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Edit Arena: ${editingGround.name}`}
          className="max-w-md"
        >
          <form onSubmit={handleUpdate} className="space-y-4 pt-4 text-left">
            <Input
              label="Arena Name"
              placeholder="e.g. Football Turf A, Court 3"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />

            <Select
              label="Associated Sport Type"
              value={editSport}
              onChange={(e) => setEditSport(e.target.value)}
              options={sportsOptions}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider block">
                Description / Equipment
              </label>
              <textarea
                className="w-full h-24 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                placeholder="Details about court size, lights, net availability..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800/80">
              <div>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Set Active Status</span>
                <span className="text-[10px] text-zinc-450 block">If offline, slots will be hidden on public site.</span>
              </div>
              <button
                type="button"
                onClick={() => setEditIsActive(!editIsActive)}
                className="text-zinc-500 focus:outline-none"
              >
                {editIsActive ? <ToggleRight className="w-7 h-7 text-indigo-500" /> : <ToggleLeft className="w-7 h-7 text-zinc-400" />}
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-900">
              <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateGroundMutation.isPending}>
                {updateGroundMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};
