// routes/class.js
const express = require("express");
const router = express.Router();
const { Class, User, Skill, Feedback, ClassFile,} = require("../models");
const authenticateJWT = require("../middleware/auth");
const multer = require("multer");
const { Op } = require("sequelize");

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
// Import the live SP transfer

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
          attributes: [
            "ID_Users",
            "Users_name",
            "profile_picture"
          ],
        },
        {
          model: User,
          as: "Student",
          attributes: [
            "ID_Users",
            "Users_name",
            "profile_picture"
          ],
        },
      ],
    });

    if (!classSession) {
      return res.status(404).json({ message: "Class session not found" });
    }

    // Check user role in this class session
    let userRole = null;
    let otherUser = null;
    let currentUser = null ;

    if (classSession.reciver_id === userId) {
      userRole = "teacher";
      otherUser = classSession.Student;
      currentUser = classSession.Teacher;
    } else if (classSession.sender_id === userId) {
      userRole = "student";
      otherUser = classSession.Teacher;
      currentUser = classSession.Student;
    } else {
      return res
        .status(403)
        .json({ message: "You are not part of this class session" });
    }

    // Calculate elapsed time if session active
    let elapsedTime = 0;
    if (classSession.is_active && classSession.start_time) {
      elapsedTime = Math.floor(
        (new Date() - new Date(classSession.start_time)) / 1000
      );
    }

    const response = {
      userRole,
      classInfo: {
        id: classSession.ID_class, // <-- use your actual PK column here
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
router.post("/feedback/:Id_class", authenticateJWT, async (req, res) => {
  const classId = req.params.Id_class;
  const userId = req.user.ID_Users;
  const { rating, comment, endreason } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be between 1 and 5" });
  }

  try {
    // Save feedback to DB
    const feedback = await Feedback.create({
      class_id: classId,
      user_id: userId,
      rating,
      comment,
      endreason,
    });

    res.json({ message: "Feedback submitted successfully", feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
