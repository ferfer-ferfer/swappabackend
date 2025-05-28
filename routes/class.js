// routes/class.js
const express = require("express");
const router = express.Router();
const { Class, User, Skill, Comment, ClassFile} = require("../models");
const authenticateJWT = require("../middleware/auth");
const multer = require("multer");
const { Sequelize, Op } = require('sequelize');
const calculateSP = require("../services/calculateSP");

const path = require("path");
const fs = require("fs");
// Define storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save to uploads folder
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// get all calsses


router.get("/classes", authenticateJWT, async (req, res) => {
  try {
    const currentUserId = req.user.ID_Users;

    if (!currentUserId) {
      return res.status(401).json({ message: "Unauthorized: User ID not found" });
    }

    // Fetch current user info
    const currentUser = await User.findByPk(currentUserId, {
      attributes: ["ID_Users", "Users_name", "profile_picture"],
    });

    // Fetch classes where user is sender (Teacher) or receiver (Student)
    const classes = await Class.findAll({
      where: {
        [Op.or]: [
          { sender_id: currentUserId },
          { reciver_id: currentUserId }
        ]
      },
      attributes: [
        "ID_class",
        "sender_id",
        "reciver_id",
        "skill_id",
        "duration",
        "time_gone",
      ],
      include: [
        { model: User, as: "Teacher", attributes: ["ID_Users", "Users_name", 'profile_picture'] },
        { model: User, as: "Student", attributes: ["ID_Users", "Users_name", 'profile_picture'] },
      ],
      order: [["ID_class", "DESC"]],
    });

    // Extract unique skill IDs
    const skillIds = [...new Set(classes.map(c => c.skill_id).filter(id => id !== null))];

    // Fetch skill names
    const skills = await Skill.findAll({
      where: { ID_skill: skillIds },
      attributes: ["ID_skill", "skills_name"],
    });

    // Create skill ID → name map
    const skillMap = {};
    skills.forEach(skill => {
      skillMap[skill.ID_skill] = skill.skills_name;
    });

    // Format response
    const formatted = classes.map((c) => {
      const teacherId = c.Teacher?.ID_Users || null;
      const studentId = c.Student?.ID_Users || null;

      let type = null;
      if (currentUserId === teacherId) type = "teacher";
      else if (currentUserId === studentId) type = "learner";

      return {
        class_id: c.ID_class,
        sender_id: teacherId,
        reciver_id: studentId,
        sender_name: c.Teacher?.Users_name || null,
        receiver_name: c.Student?.Users_name || null,
        skill_name: skillMap[c.skill_id] || null,
        duration: c.duration,
        time_gone: c.time_gone || 0,
        type,
      };
    });

    // Send response
    res.json({
      user_photo: currentUser.profile_picture,
      user_name: currentUser.Users_name,
      classes: formatted,
    });

  } catch (error) {
    console.error("Error fetching classes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


//Hedi te3 delete file
router.delete("/file/:fileId", authenticateJWT, async (req, res) => {
  const fileId = req.params.fileId;
  

  try {
    const file = await ClassFile.findByPk(fileId);

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // Optional: Only allow the uploader to delete the file
    if (file.user_id != req.user.ID_Users) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this file" });
    }

    // Delete the file from the filesystem
    fs.unlink(path.resolve(file.filepath), async (err) => {
      if (err) {
        console.error("Error deleting file from disk:", err);
        return res
          .status(500)
          .json({ message: "Failed to delete file from disk" });
      }

      // Delete the DB record after successful file deletion
      await file.destroy();

      res.json({ message: "File deleted successfully" });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// GET files uploaded to a class


router.get("/files/:Id_class", authenticateJWT, async (req, res) => {
  const classId = req.params.Id_class;

  try {
    const files = await ClassFile.findAll({
      where: { class_id: classId },
      attributes: ["id", "user_id", "filename", "filepath", "uploaded_at"],
    });

    const filesWithSize = files.map(file => {
      // Use the stored filepath directly (absolute or relative to project root)
      const fullPath = path.resolve(file.filepath);

      let sizeKB = null;
      try {
      const stats = fs.statSync(fullPath);
      sizeKB = Math.round(stats.size / 1024); // Size in KB
      } catch (err) {
      console.warn(`Could not access file: ${fullPath}`, err.message);
      }

      return {
        id: file.id,
        user_id: file.user_id,
        filename: file.filename,
        filepath: file.filepath,
        uploaded_at: file.uploaded_at,
        sizeKB,  // add size in KB
      };
    });

    res.json(filesWithSize);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch files" });
  }
});


//download files
router.get("/file/download/:fileId", async (req, res) => {
  const fileId = req.params.fileId;

  try {
    const file = await ClassFile.findByPk(fileId);

    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    const filePath = path.resolve(file.filepath);
    const fileName = file.filename;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader(
      "Content-Type",
      mime.lookup(filePath) || "application/octet-stream"
    );

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);

    readStream.on("error", (err) => {
      console.error("File stream error:", err);
      res.status(500).end();
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Upload file to a class
router.post("/upload/:Id_class",  authenticateJWT,upload.single("file"),async (req, res) => {
    const classId = req.params.Id_class;
    const userId = req.user.ID_Users;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      // Using Sequelize model ClassFile to create the record
      const uploadedFile = await ClassFile.create({
        class_id: classId,
        user_id: userId,
        filename: req.file.originalname,
        filepath: req.file.path,
      });
      console.log("Upload route hit");
      console.log("Uploaded file info:", req.file);

      res.json({ message: "File uploaded successfully", file: uploadedFile });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// get class details by ID
router.get("/:ID_class", authenticateJWT, async (req, res) => {
  try {
    const { ID_class } = req.params;
    const userId = req.user.ID_Users;

    const classSession = await Class.findOne({
      where: { ID_class: ID_class },
      include: [
        {
          model: User,
          as: "Teacher",
          attributes: ["ID_Users", "Users_name", "profile_picture"],
        },
        {
          model: User,
          as: "Student",
          attributes: ["ID_Users", "Users_name", "profile_picture"],
        },
      ],
    });

    if (!classSession) {
      return res.status(404).json({ message: "Class session not found" });
    }

    // Determine user role and participants
    let userRole, currentUser, otherUser;

    if (classSession.Teacher.ID_Users === userId) {
      userRole = "teacher";
      currentUser = classSession.Teacher;
      otherUser = classSession.Student;
    } else if (classSession.Student.ID_Users === userId) {
      userRole = "student";
      currentUser = classSession.Student;
      otherUser = classSession.Teacher;
    } else {
      return res.status(403).json({ message: "You are not part of this class session" });
    }

    // Calculate elapsed time if session is active
    let elapsedTime = 0;
    if (classSession.is_active && classSession.start_time) {
      elapsedTime = Math.floor((new Date() - new Date(classSession.start_time)) / 1000);
    }

    const response = {
      userRole,
      classInfo: {
        id: classSession.ID_class,
        isActive: classSession.is_active,
        isPaused: classSession.is_paused,
        teacherReady: classSession.is_teacher_ready,
        studentReady: classSession.is_student_ready,
        startTime: classSession.start_time,
        elapsedTime,
        pointsEarned: Math.floor(elapsedTime / 2)
      },
      currentUser: {
        id: currentUser.ID_Users,
        username: currentUser.Users_name,
        profilePicture: currentUser.profile_picture,
      },
      otherUser: {
        id: otherUser.ID_Users,
        username: otherUser.Users_name,
        profilePicture: otherUser.profile_picture,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("[Class Status Error]", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Feedback submission for a class
router.post("/:Id_class/feedback", authenticateJWT, async (req, res) => {
  const classId = req.params.Id_class;
  const userId = req.user.ID_Users;
  const { rating, comment, endreason } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be between 1 and 5" });
  }

  try {
    // Save feedback to DB
    
const classInstance = await Class.findOne({
  where: { ID_Class: classId },
  attributes: ['ID_Class', 'sender_id', 'receiver_id'] // Only get these fields
}); 
   
    const feedback = await Comment.create({
      sender_id: classInstance.sender_id,
      receiver_id: classInstance.receiver_id,
      rating,
      comment,
      endreason,
    });
const user = await User.findByPk(receiverId, { attributes: ['username'] });
const username = user ? user.username : 'Unknown user';

await Notification.create({
  userId: receiverId,
  message: `You received new feedback from user ${username}`,
  isRead: false,
});
    res.json({ message: "Feedback submitted successfully", feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


// class ready 
router.post('/:id/ready', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.ID_Users;
    const classId = req.params.id;

    // Find the class session with associated users
    const classSession = await Class.findOne({
      where: { ID_class: classId },
      include: [
        {
          model: User,
          as: 'Teacher',
          attributes: ['ID_Users']
        },
        {
          model: User,
          as: 'Student',
          attributes: ['ID_Users']
        }
      ]
    });

    if (!classSession) {
      return res.status(404).json({ error: 'Class session not found' });
    }

    // Determine user role
    const isTeacher = userId === classSession.Teacher.ID_Users;
    const isStudent = userId === classSession.Student.ID_Users;

    if (!isTeacher && !isStudent) {
      return res.status(403).json({ error: 'User not part of this class session' });
    }

    // Update ready status based on role
    if (isTeacher) {
      classSession.is_teacher_ready = true;
    } else {
      classSession.is_student_ready = true;
    }

    // Check if both parties are ready
    const bothReady = classSession.is_teacher_ready && classSession.is_student_ready;

    if (bothReady) {
      if (!classSession.is_active) {
        // Start new session
        classSession.start_time = new Date();
        classSession.is_active = true;
        classSession.is_paused = false;
      } else if (classSession.is_paused) {
        // Resume paused session
        classSession.is_paused = false;
      }

      // Mark both users as busy
      await User.update(
        { classstatus: 'busy' },
        { 
          where: { 
            ID_Users: [classSession.Teacher.ID_Users, classSession.Student.ID_Users] 
          } 
        }
      );
    }

    await classSession.save();

    return res.json({ 
      success: true, 
      classInfo: {
        isActive: classSession.is_active,
        isPaused: classSession.is_paused,
        teacherReady: classSession.is_teacher_ready,
        studentReady: classSession.is_student_ready,
        startTime: classSession.start_time
      }
    });

  } catch (error) {
    console.error('Error in /class/:id/ready:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});




// class pause
router.post('/:id/pause', async (req, res) => {
  const classId = req.params.id;
  const session = await Class.findByPk(classId);

  if (!session || !session.is_active) return res.status(400).json({ error: 'Session not active' });

  const now = new Date();
  const timeElapsed = Math.floor((now - session.start_time) / 60000); // in minutes

  session.time_gone += timeElapsed;
  session.is_paused = true;
  session.is_teacher_ready = false;
  session.is_student_ready = false;
  session.start_time = null; // reset start_time until resumed

  await session.save();
  return res.json({ paused: true, session });
});
 

// class stop 

router.post('/:id/stop', authenticateJWT, async (req, res) => {
  try {
    const classId = req.params.id;
    const userId = req.user.ID_Users;
    const { hours, sp } = req.body;  // hours and sp sent from frontend

    if (!hours || typeof hours !== 'number' || hours <= 0) {
      return res.status(400).json({ message: 'Invalid or missing study hours.' });
    }
    if (typeof sp !== 'number') {
      return res.status(400).json({ message: 'Invalid or missing SP value.' });
    }

    const foundClass = await Class.findByPk(classId);
    if (!foundClass) {
      return res.status(404).json({ message: 'Class not found.' });
    }

    const { sender_id, reciver_id, duration, time_gone } = foundClass;

    if (userId !== sender_id && userId !== reciver_id) {
      return res.status(403).json({ message: 'Not authorized to stop this class.' });
    }

    // Calculate new time_gone (accumulate hours)
    let newTimeGone = time_gone + hours;

    // Cap time_gone to duration
    if (newTimeGone > duration) newTimeGone = duration;

    // Update class info
    await foundClass.update({
      end_time: new Date(),
      time_gone: newTimeGone,
      is_active: false,
      SP_N_P: sp,
      is_teacher_ready: false,
      is_student_ready: false,
    });

    // Load teacher and student users
    const teacher = await User.findByPk(reciver_id);
    const student = await User.findByPk(sender_id);

    if (!teacher || !student) {
      return res.status(404).json({ message: 'Teacher or student not found.' });
    }

    // Add SP to teacher
    teacher.SP += sp;
    teacher.total_time_teaching_h += hours;
    await teacher.save();

    // Subtract SP from student (min 0)
    student.SP -= sp;
    if (student.SP < 0) student.SP = 0;
    student.total_time_learning_h += hours;
    await student.save();
     // Calculate SP with bonuses for teacher and student
    const teacherSP = await calculateSP(sender_id, { type: 'teaching', value: hours });
    const studentSP = await calculateSP(reciver_id, { type: 'learning', value: hours });

const completedSkills = await Class.findAll({
  attributes: [[Sequelize.col('skill.skills_name'), 'skill_name']],
  where: {
    sender_id: userId,  // student id
    duration: { [Op.eq]: Sequelize.col('time_gone') }
  },
  include: [{
    model: Skill,
    as: 'skill',
    attributes: [],
  }],
  group: ['skill.skills_name']
});
    const skillBonusSP = 0; // 
    if (completedSkills.length == 3) {
      skillBonusSP = await calculateSP(reciver_id, { type: 'skills', value: completedSkills.length });
    }
    res.status(200).json({
      message: 'Class stopped and SP updated',
      spAddedToTeacher: sp + teacherSP + skillBonusSP,
      spSubtractedFromStudent: sp,
      spAddToStudent: studentSP,
      time_gone_hours: newTimeGone,
    });

  } catch (error) {
    console.error('Error stopping class:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// class status
router.get("/:ID_class/status", authenticateJWT, async (req, res) => {
  try {
    const { ID_class } = req.params;
    const userId = req.user.ID_Users;

    const classSession = await Class.findOne({
      where: { ID_class },
      include: [
        {
          model: User,
          as: "Teacher",
          attributes: ["ID_Users"],
        },
        {
          model: User,
          as: "Student",
          attributes: ["ID_Users"],
        },
      ],
    });

    if (!classSession) {
      return res.status(404).json({ message: "Class session not found" });
    }

    // Check if the requesting user is involved
    if (![classSession.sender_id, classSession.reciver_id].includes(userId)) {
      return res.status(403).json({ message: "Access denied to this class" });
    }

    // Determine roles
    const teacherReady = !!classSession.is_teacher_ready;
    const studentReady = !!classSession.is_student_ready;

    // Determine status
    let status = "waiting";
    if (classSession.is_active) {
      status = classSession.is_paused ? "paused" : "active";
    } else if (classSession.ended_at) {
      status = "ended";
    }

    res.status(200).json({
      status,
      ready: {
        teacher: teacherReady,
        student: studentReady,
      },
    });
  } catch (error) {
    console.error("[Class Status Error]", error);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
