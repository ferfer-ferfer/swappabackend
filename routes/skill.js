const express = require('express');
const router = express.Router();
const { Skill, User,UserSkill } = require('../models');
const { Op } = require('sequelize');

// Add skill to the user's profile
router.post('/add-skill', async (req, res) => {
  const { name } = req.body;

  try {
    // Check if the skill already exists
    let skill = await Skill.findOne({ where: { name } });

    // If skill doesn't exist, create it
    if (!skill) {
      skill = await Skill.create({ name });
    }

    // Get the logged-in user
    const user = await User.findByPk(req.user.ID_Users);

    // Add the skill to the user's profile
    await user.addSkill(skill);

    res.status(200).json({ message: 'Skill added successfully.' });
  } catch (err) {
    console.error('Add skill error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove skill from the user's profile
router.delete('/remove-skill/:skillId', async (req, res) => {
  const { skillId } = req.params;

  try {
    const user = await User.findByPk(req.user.ID_Users);
    const skill = await Skill.findByPk(skillId);

    if (!skill) {
      return res.status(404).json({ message: 'Skill not found.' });
    }

    // Remove the skill from the user's profile
    await user.removeSkill(skill);
    res.status(200).json({ message: 'Skill removed successfully.' });
  } catch (err) {
    console.error('Remove skill error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search for skills based on a search query
router.get('/search-skills', async (req, res) => {
  const { search } = req.query;

  try {
    const skills = await Skill.findAll({
      where: {
        name: {
          [Op.like]: `%${search || ''}%`, // Match skills based on the search query
        },
      },
    });

    res.status(200).json(skills);
  } catch (err) {
    console.error('Search skills error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});




router.get('/skills/:userid', async (req, res) => {
  const { userid } = req.params;

  try {
    const rows = await UserSkill.findAll({
      where: { userId: userid },
      include: [{ model: Skill, attributes: ['skills_name'] }], 
      raw: true, 
    });

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User skills not found' });
    }

   
    const teaching = [];
    const learning = [];

    rows.forEach(r => {
      const skillName = r['Skill.skills_name'];
      if (r.type === 'teach') teaching.push(skillName);
      else if (r.type === 'learn') learning.push(skillName);
    });
    res.json({ teaching, learning });
  } catch (err) {
    console.error('GET skills error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
module.exports = router;
