// routes/class.js
const express = require('express');
const router = express.Router();
const {  Class, User,  Request } = require('../models');
const authenticateJWT = require('../middleware/auth');
const calculateSP = require('../services/calculateSP');
const startLiveSPTransfer = require('../services/liveSPTransfer'); // Import the live SP transfer

// Mark user as ready or create class if it doesn't exist
router.post('/start', authenticateJWT, async (req, res) => {
  const { request_id, role } = req.body;

  try {
    const userId = req.user.id;
    const request = await Request.findByPk(request_id);
    if (!request) return res.status(404).json({ message: 'Request not found' });

    // Check if class already exists for this request
    let session = await Class.findOne({ where: { request_id } });
 
 
    if (!session && role === 'student') {
      return res.status(400).json({ message: 'Class not found. Wait for teacher to start.' });
    }
    
    // If not, create the class session (sender = student, receiver = teacher)
    if (!session) {
      session = await Class.create({
        request_id,
        sender_id: request.sender_id, // student
        reciver_id: request.reciver_id, // teacher
        is_teacher_ready: false,
        is_student_ready: false,
        is_active: false,
        is_paused: false,
        SP_N_P: 0
      });
    }

    // Mark ready
    if (role === 'teacher') session.is_teacher_ready = true;
    if (role === 'student') session.is_student_ready = true;

    // Activate if both ready
    if (session.is_teacher_ready && session.is_student_ready && !session.is_active) {
      session.is_active = true;
      session.start_time = new Date();
      session.last_sp_update = new Date();
      startLiveSPTransfer(); // Start background SP transfer
    }

    await session.save();
    return res.status(200).json({ message: `Marked ${role} as ready`, class: session });
  } catch (error) {
    console.error('[Class Start Error]', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Pause or resume class session (temporary stop of timer)
router.post('/resume', authenticateJWT, async (req, res) => {
  const { ID_class } = req.body;

  try {
    const session = await Class.findByPk(ID_class);
    if (!session || !session.is_active) {
      return res.status(400).json({ message: 'Class not active or not found' });
    }

    session.is_paused = !session.is_paused;
    await session.save();

    return res.status(200).json({
      message: session.is_paused ? 'Class paused temporarily' : 'Class resumed',
      paused: session.is_paused
    });
  } catch (error) {
    console.error('[Class Resume Error]', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Stop the class session manually or due to SP depletion
router.post('/stop', authenticateJWT, async (req, res) => {
  const { ID_class } = req.body;

  try {
    const session = await Class.findByPk(ID_class);
    if (!session || !session.is_active) {
      return res.status(400).json({ message: 'Class not active or not found' });
    }

    // Calculate total duration
    const endTime = new Date();
    const durationHours = (endTime - new Date(session.start_time)) / (1000 * 60 * 60);

    // Stop session
    session.is_active = false;
    session.is_paused = false;
    session.end_time = endTime;

    // Award SP to teacher (receiver)
    const earnedSP = await calculateSP(session.reciver_id, {
      type: 'teaching',
      value: durationHours,
      timeFrame: 'day'
    });
    session.SP_N_P += earnedSP;

    // Deduct SP from student (sender)
    const student = await User.findByPk(session.sender_id);
    if (student) {
      student.SP = Math.max(0, (student.SP || 0) - earnedSP);
      student.total_time_learning_h = (student.total_time_learning_h || 0) + durationHours;
      await student.save();
    }

    await session.save();

    return res.status(200).json({
      message: `Class ended. Earned ${earnedSP} SP`,
      duration_h: durationHours.toFixed(2),
      SP: earnedSP
    });
  } catch (error) {
    console.error('[Class Stop Error]', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
