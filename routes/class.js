// routes/class.js
const express = require('express');
const router = express.Router();
const {  Class, User, Skill, Request, Feedback, ClassFile } = require('../models');
const authenticateJWT = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Define storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save to uploads folder
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });
 // Import the live SP transfer

// get all calsses
router.get('/classes', authenticateJWT, async (req, res) => {
  try {
    const currentUserId = req.user.ID_Users;
        if (!currentUserId) {
      return res.status(401).json({ message: "Unauthorized: User ID not found" });
    }
    const currentUser = await User.findByPk(currentUserId, {
      attributes: ['ID_Users', 'Users_name', 'profile_picture']
    });

    // Step 1: Fetch all classes (include skill_id)
    const classes = await Class.findAll({
      attributes: ['ID_class', 'sender_id', 'reciver_id', 'skill_id', 'duration', 'time_gone'],
      include: [
        { model: User, as: 'Sender', attributes: ['ID_Users', 'Users_name'] },
        { model: User, as: 'Receiver', attributes: ['ID_Users', 'Users_name'] }
      ],
      order: [['ID_class', 'DESC']]
    });

    // Step 2: Collect distinct skill IDs from classes
    const skillIds = [...new Set(classes.map(c => c.skill_id).filter(id => id !== null))];

    // Step 3: Fetch skills for those IDs
    const skills = await Skill.findAll({
      where: { ID_skill: skillIds },
      attributes: ['ID_skill', 'skills_name']
    });

    // Step 4: Map skill ID to skill name
    const skillMap = {};
    skills.forEach(skill => {
      skillMap[skill.ID_skill] = skill.skills_name;
    });

    // Step 5: Format the class data
    const formatted = classes.map(c => {
      const senderId = c.Sender?.ID_Users || null;
      const receiverId = c.Receiver?.ID_Users || null;

      let type = null;
      if (currentUserId === senderId) type = 'teacher';
      else if (currentUserId === receiverId) type = 'learner';

      return {
        class_id: c.ID_class,
        sender_id: senderId,
        reciver_id: receiverId,
        sender_name: c.Sender?.Users_name || null,
        receiver_name: c.Receiver?.Users_name || null,
        skill_name: skillMap[c.skill_id] || null,  // get skill name by skill_id from map
        duration: c.duration,
        time_gone: c.time_gone || 0,
        type
      };
    });
     
      res.json({
      user_photo: currentUser.profile_picture,
      user_name: currentUser.Users_name,
      classes: formatted
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
 
// GET files uploaded to a class
router.get('/files/:Id_class/', authenticateJWT, async (req, res) => {
  const classId = req.params.Id_class;

  try {
    const files = await ClassFile.findAll({
      where: { class_id: classId },
      attributes: ['id', 'user_id', 'filename', 'filepath', 'uploaded_at']
    });

    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch files' });
  }
});

// Upload file to a class
router.post('/upload/:Id_class', authenticateJWT, upload.single('file'), async (req, res) => {
  const classId = req.params.Id_class;
  const userId = req.user.ID_Users;

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    // Using Sequelize model ClassFile to create the record
    const uploadedFile = await ClassFile.create({
      class_id: classId,
      user_id: userId,
      filename: req.file.originalname,
      filepath: req.file.path
    });

    res.json({ message: 'File uploaded successfully', file: uploadedFile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// get class details by ID
router.get('/:ID_class', authenticateJWT, async (req, res) => {
 try {
    const { classId } = req.params;
    const userId = req.user.id;

    // Find the class session
    const classSession = await Class.findByPk(classId, {
      include: [
        {
          model: Request,
          attributes: ['subject', 'description', 'created_at']
        },
        {
          model: User,
          as: 'Teacher',
          foreignKey: 'reciver_id',
          attributes: ['id', 'username', 'email', 'profile_picture', 'rating', 'total_time_teaching_h']
        },
        {
          model: User,
          as: 'Student',
          foreignKey: 'sender_id',
          attributes: ['id', 'username', 'email', 'profile_picture', 'total_time_learning_h']
        }
      ]
    });

    if (!classSession) {
      return res.status(404).json({ message: 'Class session not found' });
    }

    // Determine user role in this class
    let userRole = null;
    let otherUser = null;
    
    if (classSession.reciver_id === userId) {
      userRole = 'teacher';
      otherUser = classSession.Student;
    } else if (classSession.sender_id === userId) {
      userRole = 'student';
      otherUser = classSession.Teacher;
    } else {
      return res.status(403).json({ message: 'You are not part of this class session' });
    }

    // Calculate elapsed time if session is active
    let elapsedTime = 0;
    if (classSession.is_active && classSession.start_time) {
      elapsedTime = Math.floor((new Date() - new Date(classSession.start_time)) / 1000);
    }

    // Format response
    const response = {
      userRole,
      classInfo: {
        id: classSession.id,
        isActive: classSession.is_active,
        isPaused: classSession.is_paused,
        teacherReady: classSession.is_teacher_ready,
        studentReady: classSession.is_student_ready,
        startTime: classSession.start_time,
        elapsedTime,
        pointsEarned: Math.floor(elapsedTime / 2), // 1 point per 2 seconds
        requestSubject: classSession.Request?.subject,
        requestDescription: classSession.Request?.description
      },
      currentUser: {
        id: req.user.id,
        username: req.user.username,
        profilePicture: req.user.profile_picture,
       
      },
      otherUser: {
        id: otherUser.id,
        username: otherUser.username,
        profilePicture: otherUser.profile_picture

      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('[Class Status Error]', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Feedback submission for a class
router.post('/feedback/:Id_class', authenticateJWT, async (req, res) => {
  const classId = req.params.Id_class;
  const userId = req.user.ID_Users;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  try {
    // Save feedback to DB
    const feedback = await Feedback.create({
      class_id: classId,
      user_id: userId,
      rating,
      comment
    });

    res.json({ message: 'Feedback submitted successfully', feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
