import { z } from 'zod';

export const reviewSchema = z.object({
  customerName: z.string().min(2, 'Name must be at least 2 characters'),
  rating: z.number().min(1).max(5, 'Rating must be between 1 and 5'),
  comment: z.string().min(5, 'Comment must be at least 5 characters'),
});
