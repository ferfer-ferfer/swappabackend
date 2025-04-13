// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const router = express.Router();
const bcrypt = require('bcrypt');
require('dotenv').config();


// POST /api/auth/register
router.post('/register', async (req, res) => {

  
    const { email, password, username } = req.body;
    if (!email || !password || !username) {
    return res.status(400).json({ message: 'Email, username, and password are required' });
  }
    try {
      console.log('Incoming registration:', { email, username });
  
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        console.log(' Email already registered');
        return res.status(400).json({ message: 'Email already registered' });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log(' Password hashed');
  
      const newUser = await User.create({
        email,
        password: hashedPassword,
        username,
      });
  
      console.log('User created:', newUser.id);
  
      const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET_KEY, {
        expiresIn: '1h',
      });
  
      res.status(201).json({ message: 'User registered', token });
    } catch (error) {
      console.error(' Registration error:', error);
      res.status(500).json({ message: 'Server error', error });
    }
  });
  
// POST /api/auth/login - Login route to generate JWT token
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log("🟡 Login attempt with:", email);
  
    try {
      const user = await User.findOne({ where: { email } });
  
      if (!user) {
        console.log("❌ User not found");
        return res.status(401).json({ message: 'Invalid email or password' });
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log("❌ Password mismatch");
        return res.status(401).json({ message: 'Invalid email or password' });
      }
  
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
      console.log("✅ Login successful, token generated");
  
      return res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
      console.error("❌ Login error:", error);
      return res.status(500).json({ message: 'Server error', error });
    }
  });
  
  module.exports = router;

