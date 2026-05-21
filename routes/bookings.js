const router = require('express').Router();
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.post('/check-availability', async (req, res) => {
  try {
    const { roomId, date, startTime, endTime } = req.body;
    
    const conflictingBooking = await Booking.findOne({
      room: roomId,
      date: new Date(date),
      status: 'confirmed',
      $or: [
        { startTime: { $lt: endTime, $gte: startTime } },
        { endTime: { $gt: startTime, $lte: endTime } }
      ]
    });
    
    res.json({ available: !conflictingBooking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, totalCost, specialNote } = req.body;
    
    const conflictingBooking = await Booking.findOne({
      room: roomId,
      date: new Date(date),
      status: 'confirmed',
      $or: [
        { startTime: { $lt: endTime, $gte: startTime } },
        { endTime: { $gt: startTime, $lte: endTime } }
      ]
    });
    
    if (conflictingBooking) {
      return res.status(400).json({ message: 'Time slot already booked' });
    }
    
    const booking = new Booking({
      room: roomId,
      user: req.user.id,
      date: new Date(date),
      startTime,
      endTime,
      totalCost,
      specialNote
    });
    
    await booking.save();
    
    await User.findByIdAndUpdate(req.user.id, {
      $push: { bookings: booking._id }
    });
    
    await Room.findByIdAndUpdate(roomId, {
      $inc: { bookingCount: 1 }
    });
    
    const populatedBooking = await Booking.findById(booking._id)
      .populate('room')
      .populate('user', 'name email');
    
    res.status(201).json(populatedBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/my-bookings', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('room')
      .sort({ createdAt: -1 });
    
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to cancel this booking' });
    }
    
    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking already cancelled' });
    }
    
    booking.status = 'cancelled';
    await booking.save();
    
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { bookings: booking._id }
    });
    
    await Room.findByIdAndUpdate(booking.room, {
      $inc: { bookingCount: -1 }
    });
    
    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;