const { ClassSession, SPTransaction, User } = require('../models');
const calculateSP = require('../utils/spCalculator');
const { Op } = require('sequelize');

exports.markUserReady = async (req, res) => {
  const { userId, skillId, teacherId } = req.body;

  if (!userId || !skillId || !teacherId) {
    return res.status(400).json({ error: 'Missing userId, skillId, or teacherId' });
  }

  try {
    // Try to find an ongoing session
    let session = await ClassSession.findOne({
      where: {
        [Op.or]: [
          { teacherId: userId },
          { studentId: userId }
        ],
        teacherId: teacherId,
        skillId: skillId,
        endTime: null
      }
    });

    // If session doesn't exist, create a new one
    if (!session) {
      session = await ClassSession.create({
        teacherId,
        studentId: userId, 
        skillId
      });
    }

    // Mark readiness
    if (userId === session.teacherId) session.teacherReady = true;
    if (userId === session.studentId) session.studentReady = true;

    // Start session if both are ready
    if (session.teacherReady && session.studentReady && !session.startTime) {
      session.startTime = new Date();
    }

    await session.save();
    res.status(200).json({ message: 'User marked as ready', session });

  } catch (error) {
    console.error('Error in markUserReady:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


exports.stopClass = async (req, res) => {
  const { sessionId, reason } = req.body;
  const session = await ClassSession.findByPk(sessionId);
  if (!session || session.endTime) return res.status(404).json({ error: 'Invalid session' });

  const now = new Date();
  const duration = Math.ceil((now - session.startTime) / 60000);
  const spAmount = calculateSP(duration);

  const teacher = await User.findByPk(session.teacherId);
  const student = await User.findByPk(session.studentId);

  session.endTime = now;
  session.duration = duration;
  session.spEarned = spAmount;
  await session.save();

  // Update SP
  teacher.spPoints += spAmount;
  student.spPoints = Math.max(0, student.spPoints - spAmount);
  await teacher.save();
  await student.save();

  // Log SP
  await SPTransaction.bulkCreate([
    { userId: teacher.id, amount: spAmount, type: 'class_reward', description: 'Teaching session reward' },
    { userId: student.id, amount: -spAmount, type: 'class_deduction', description: 'Learning session cost' }
  ]);

  res.json({ message: 'Class session ended', duration, spAmount, reason });
};

// Optional: Auto-stop logic (cron job or socket monitor)
exports.autoStopIfInsufficientSP = async () => {
  const ongoingSessions = await ClassSession.findAll({
    where: { endTime: null, startTime: { [Op.ne]: null } }
  });

  for (const session of ongoingSessions) {
    const student = await User.findByPk(session.studentId);
    const duration = Math.ceil((new Date() - session.startTime) / 60000);
    const cost = calculateSP(duration);

    if (student.spPoints < cost) {
      // Stop class
      session.endTime = new Date();
      session.duration = duration;
      session.spEarned = cost;
      await session.save();

      const teacher = await User.findByPk(session.teacherId);
      teacher.spPoints += cost;
      student.spPoints = 0;
      await teacher.save();
      await student.save();

      await SPTransaction.bulkCreate([
        { userId: teacher.id, amount: cost, type: 'class_reward', description: 'Auto-ended: teaching' },
        { userId: student.id, amount: -cost, type: 'class_deduction', description: 'Auto-ended: learning' }
      ]);
    }
  }
};