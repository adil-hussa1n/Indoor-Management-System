import Contact from '../models/Contact.js';
import { contactSchema } from '../validators/contact.validator.js';

// Public Contact Submission
export const submitContact = async (req, res, next) => {
  try {
    const validation = contactSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors.map((e) => e.message).join(', '),
      });
    }

    const contact = await Contact.create(validation.data);

    const io = req.app.get('io');
    if (io) {
      io.emit('new-message', contact);
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully. We will get back to you soon!',
      contact,
    });
  } catch (error) {
    next(error);
  }
};

// Admin Contact Management
export const getMessages = async (req, res, next) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, messages });
  } catch (error) {
    next(error);
  }
};

export const updateMessageStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isRead, replyStatus } = req.body;

    const message = await Contact.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (isRead !== undefined) message.isRead = isRead;
    if (replyStatus !== undefined) message.replyStatus = replyStatus;

    await message.save();
    res.status(200).json({ success: true, message });
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const message = await Contact.findByIdAndDelete(id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    res.status(200).json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    next(error);
  }
};
