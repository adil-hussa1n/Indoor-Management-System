import { z } from 'zod';

export const bookingSchema = z.object({
  customerName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(7, 'Phone number must be at least 7 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  sport: z.string().min(2, 'Please select a sport'),
  bookingDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  startTime: z.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid start time format (HH:MM)'),
  endTime: z.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid end time format (HH:MM)'),
  duration: z.number().min(1, 'Duration must be at least 1 hour'),
  players: z.number().min(1, 'Number of players must be at least 1'),
  notes: z.string().optional(),
});
