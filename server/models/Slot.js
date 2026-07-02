import mongoose from 'mongoose';

const slotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String, // "HH:MM"
      required: true,
    },
    endTime: {
      type: String, // "HH:MM"
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    dayOfWeek: {
      type: Number, // -1 = default daily, 0-6 = Sunday-Saturday specific
      default: -1,
      index: true,
    },
    specificDate: {
      type: String, // "YYYY-MM-DD"
      default: null,
      index: true,
    },
    rateType: {
      type: String,
      enum: ['day', 'night'],
      default: 'day',
    },
  },
  { timestamps: true }
);

// Prevent duplicate slot ranges for the same day category
slotSchema.index({ startTime: 1, endTime: 1, dayOfWeek: 1, specificDate: 1 }, { unique: true });

const Slot = mongoose.model('Slot', slotSchema);
export default Slot;
