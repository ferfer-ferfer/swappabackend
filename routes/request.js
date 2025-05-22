const express = require("express");
const { Request , Skill } = require("../models");
const isAuthenticated = require("../middleware/auth");

const router = express.Router();

router.post("/send-request", isAuthenticated, async (req, res) => {
  try {
    const sender_id = req.user.ID_Users; // Extracted from token
    const { reciver_id, skill: skillName, message, duration } = req.body;

    if (!reciver_id || !skillName || !message || !duration) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find skill by name
    const skillRecord = await Skill.findOne({ where: {skills_name: skillName } });

    if (!skillRecord) {
      return res.status(404).json({ message: `Skill '${skillName}' not found.` });
    }

    // Create the request
    const newRequest = await Request.create({
      sender_id,
      reciver_id,
      skill_id: skillRecord.ID_skill,
      message,
      duration,
      status_request: 'pending',
      created_at: new Date()
    });

    res.status(201).json({ message: 'Request sent successfully', request: newRequest });
  } catch (err) {
    console.error('Request creation error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
module.exports = router;
