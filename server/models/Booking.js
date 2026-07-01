import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    sport: {
      type: String,
      required: true,
      trim: true,
    },
    bookingDate: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: String, // "HH:MM"
      required: true,
    },
    endTime: {
      type: String, // "HH:MM"
      required: true,
    },
    duration: {
      type: Number, // In hours
      required: true,
    },
    players: {
      type: Number,
      required: true,
      min: 1,
    },
    notes: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
  },
  { timestamps: true }
);

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
