import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import API from '../services/api';

// --- SETTINGS HOOKS ---
export const usePublicSettings = () => {
  return useQuery({
    queryKey: ['publicSettings'],
    queryFn: async () => {
      const response = await API.get('/info');
      return response.data.settings;
    },
  });
};

export const useAdminSettings = () => {
  return useQuery({
    queryKey: ['adminSettings'],
    queryFn: async () => {
      const response = await API.get('/settings');
      return response.data.settings;
    },
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updatedData) => {
      const isFormData = updatedData instanceof FormData;
      const response = await API.patch('/settings', updatedData, {
        headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
      });
      return response.data.settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
      queryClient.invalidateQueries({ queryKey: ['publicSettings'] });
    },
  });
};

// --- SLOTS HOOKS ---
export const useAvailableSlots = (date) => {
  return useQuery({
    queryKey: ['availableSlots', date],
    queryFn: async () => {
      if (!date) return { slots: [], isBlocked: false };
      const response = await API.get(`/available-slots?date=${date}`);
      return response.data;
    },
    enabled: !!date,
  });
};

export const useAdminSlots = () => {
  return useQuery({
    queryKey: ['adminSlots'],
    queryFn: async () => {
      const response = await API.get('/slots');
      return response.data.slots;
    },
  });
};

export const useCreateSlot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (slotData) => {
      const response = await API.post('/slots', slotData);
      return response.data.slot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSlots'] });
    },
  });
};

export const useUpdateSlot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await API.patch(`/slots/${id}`, data);
      return response.data.slot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSlots'] });
    },
  });
};

export const useDeleteSlot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await API.delete(`/slots/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSlots'] });
    },
  });
};

// --- BOOKINGS HOOKS ---
export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingData) => {
      const response = await API.post('/booking', bookingData);
      return response.data.booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availableSlots'] });
      queryClient.invalidateQueries({ queryKey: ['adminBookings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useAdminBookings = (params) => {
  return useQuery({
    queryKey: ['adminBookings', params],
    queryFn: async () => {
      const response = await API.get('/bookings', { params });
      return response.data;
    },
  });
};

export const useCreateManualBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bookingData) => {
      const response = await API.post('/bookings', bookingData);
      return response.data.booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availableSlots'] });
      queryClient.invalidateQueries({ queryKey: ['adminBookings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useUpdateBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await API.patch(`/bookings/${id}`, data);
      return response.data.booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availableSlots'] });
      queryClient.invalidateQueries({ queryKey: ['adminBookings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useUpdateBookingStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await API.patch(`/booking-status/${id}`, { status });
      return response.data.booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availableSlots'] });
      queryClient.invalidateQueries({ queryKey: ['adminBookings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await API.delete(`/bookings/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availableSlots'] });
      queryClient.invalidateQueries({ queryKey: ['adminBookings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

// --- REVIEWS HOOKS ---
export const usePublicReviews = () => {
  return useQuery({
    queryKey: ['publicReviews'],
    queryFn: async () => {
      const response = await API.get('/reviews');
      return response.data.reviews;
    },
  });
};

export const useCreateReview = () => {
  return useMutation({
    mutationFn: async (reviewData) => {
      const response = await API.post('/reviews', reviewData);
      return response.data;
    },
  });
};

export const useAdminReviews = () => {
  return useQuery({
    queryKey: ['adminReviews'],
    queryFn: async () => {
      const response = await API.get('/reviews/all');
      return response.data.reviews;
    },
  });
};

export const useUpdateReviewStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await API.patch(`/reviews/${id}`, data);
      return response.data.review;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReviews'] });
      queryClient.invalidateQueries({ queryKey: ['publicReviews'] });
    },
  });
};

export const useDeleteReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await API.delete(`/reviews/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReviews'] });
      queryClient.invalidateQueries({ queryKey: ['publicReviews'] });
    },
  });
};

// --- CONTACT HOOKS ---
export const useSubmitContact = () => {
  return useMutation({
    mutationFn: async (contactData) => {
      const response = await API.post('/contact', contactData);
      return response.data;
    },
  });
};

export const useAdminMessages = () => {
  return useQuery({
    queryKey: ['adminMessages'],
    queryFn: async () => {
      const response = await API.get('/messages');
      return response.data.messages;
    },
  });
};

export const useUpdateMessageStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await API.patch(`/messages/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminMessages'] });
    },
  });
};

export const useDeleteMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await API.delete(`/messages/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminMessages'] });
    },
  });
};

// --- GALLERY HOOKS ---
export const usePublicGallery = () => {
  return useQuery({
    queryKey: ['gallery'],
    queryFn: async () => {
      const response = await API.get('/gallery');
      return response.data.images;
    },
  });
};

export const useUploadGalleryImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData) => {
      const response = await API.post('/gallery', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.image;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
};

export const useDeleteGalleryImage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const response = await API.delete(`/gallery/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
};

export const useReorderGallery = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orders) => {
      const response = await API.post('/gallery/reorder', { orders });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
};

// --- DASHBOARD HOOKS ---
export const useDashboardData = (date) => {
  return useQuery({
    queryKey: ['dashboard', date],
    queryFn: async () => {
      const response = await API.get('/dashboard', { params: { date } });
      return response.data;
    },
    refetchInterval: 30000, // Autofetch dashboard every 30 seconds
  });
};
