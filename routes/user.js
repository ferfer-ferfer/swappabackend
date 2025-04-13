
const express = require('express');
const { User, Skill } = require('../models');
const authenticateJWT = require('../middleware/auth');
const router = express.Router();

// POST /api/user/info - Save additional user information
router.post('/info', authenticateJWT, async (req, res) => {
  const { email,username, firstName, lastName, age } = req.body;
  console.log(" Incoming data:", req.body);
  console.log(" Authenticated user ID:", req.user);

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { email } = user; 
    user.username = username;
    user.firstName = firstName;
    user.lastName = lastName;
    user.age = age;
    await user.save();

    return res.status(200).json({ message: 'User info updated successfully', user });
  } catch (error) {
    console.error(" Server error:", error);
    return res.status(500).json({ message: 'Server error', error });
  }
});


// POST /api/user/skills - Add user skills
router.post('/skills', authenticateJWT, async (req, res) => {
  const { skills } = req.body; // Array of skill names

  if (!skills || skills.length === 0) {
    return res.status(400).json({ message: 'At least one skill is required' });
  }

  // Validate skill names (Optional but useful)
  const invalidSkills = skills.filter(skill => typeof skill !== 'string' || skill.trim() === '');
  if (invalidSkills.length > 0) {
    return res.status(400).json({ message: 'Invalid skill names', invalidSkills });
  }

  try {
    const user = await User.findByPk(req.user.id); // Assuming JWT contains user ID
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Find or create skills
    const skillInstances = await Promise.all(
      skills.map(skillName => Skill.findOrCreate({ where: { name: skillName } }))
    );

    // Associate skills with user
    await user.setSkills(skillInstances.map(([skill]) => skill)); // setSkills is a Sequelize method for many-to-many relations

    return res.status(200).json({ message: 'Skills added successfully', skills: skillInstances.map(([skill]) => skill.name) });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error });
  }
});

module.exports = router;
