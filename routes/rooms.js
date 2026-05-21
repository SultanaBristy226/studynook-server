const router = require('express').Router();
const Room = require('../models/Room');
const authMiddleware = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { search, amenities, minRate, maxRate, floor, minCapacity, sort } = req.query;
    
    let query = {};
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    if (amenities) {
      const amenitiesArray = amenities.split(',');
      query.amenities = { $all: amenitiesArray };
    }
    
    if (minRate || maxRate) {
      query.hourlyRate = {};
      if (minRate) query.hourlyRate.$gte = parseInt(minRate);
      if (maxRate) query.hourlyRate.$lte = parseInt(maxRate);
    }
    
    if (floor) {
      query.floor = floor;
    }
    
    if (minCapacity) {
      query.capacity = { $gte: parseInt(minCapacity) };
    }
    
    let sortOption = {};
    if (sort === 'price_asc') sortOption = { hourlyRate: 1 };
    else if (sort === 'price_desc') sortOption = { hourlyRate: -1 };
    else if (sort === 'newest') sortOption = { createdAt: -1 };
    else sortOption = { createdAt: -1 };
    
    const rooms = await Room.find(query).sort(sortOption).populate('owner', 'name email');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/latest', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: -1 }).limit(6).populate('owner', 'name');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate('owner', 'name email photoURL');
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const roomData = {
      ...req.body,
      owner: req.user.id
    };
    
    const room = new Room(roomData);
    await room.save();
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    if (room.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this room' });
    }
    
    const updatedRoom = await Room.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    res.json(updatedRoom);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    if (room.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this room' });
    }
    
    await Room.findByIdAndDelete(req.params.id);
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;