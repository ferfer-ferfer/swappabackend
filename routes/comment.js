const express = require('express');
const router = express.Router();
const { Comment , User } = require('../models'); 
const authenticate = require('../middleware/auth');

// POST a new comment
router.post('/comments', authenticate, async (req, res) => {
  try {
    const sender_id = req.user.ID_Users;
    const { receiver_id, comment, rating } = req.body;

    if (!receiver_id || !comment || rating === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

   

    // Create the new comment
    const newComment = await Comment.create({
      sender_id,
      receiver_id,
      comment,
      rating
    });
  console.log('New comment created:', newComment);
    // Update nbr_rate for receiver
    // Get all comments for the receiver to calculate the average rating
    const receiverComments = await Comment.findAll({
      where: { receiver_id },
      attributes: ['rating']
    });
    const nbr_rate = receiverComments.length;
    const totalRating = receiverComments.reduce((sum, c) => sum + c.rating, 0);
    const rate = nbr_rate > 0 ? totalRating / nbr_rate : 0;

    // Update the User model for the receiver
await User.update(
  { nbr_rate: nbr_rate, rate: rate },
  { where: { ID_Users: receiver_id } }
);

    res.status(201).json(newComment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// DELETE comment

router.delete('/comments/:id', authenticate, async (req, res) => {
  try {
    const commentId = req.params.id;
    const senderId = req.user.ID_Users;  // From auth token

    // Find the comment to ensure it exists and belongs to the sender
    const comment = await Comment.findOne({ where: { id: commentId } });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Optional: Only allow sender to delete their own comments
    if (comment.sender_id !== senderId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }
      const count = await Comment.count({
      where: { receiver_id: receiverId }
    }); 
    user.nbr_rate = count;
    await comment.destroy();

    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Get all comments for a specific user
router.get('/comments/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
const comments = await Comment.findAll({
  where: { receiver_id: userId },
  attributes: ['id', 'comment', 'rating', 'sender_id', 'createdAt'],
  include: [
    {
      model: User,
      as: 'sender',      // Make sure you defined this association in your models
      attributes: ['ID_Users', 'Users_name', 'first_name', 'last_name']
    }
  ]
});

    res.status(200).json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// GET all comments for a user
router.get('/comments', authenticate, async (req, res) => {
  try {
    const userId = req.user.UsersId;  
const comments = await Comment.findAll({
  where: { receiver_id: userId },
  include: [{
    model: User,
    as: 'sender',
    attributes: ['Users_name', 'first_name', 'last_name', 'profile_picture'] 
  }],
  order: [['createdAt', 'DESC']]
});


    res.status(200).json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Count how many comments a user has received
router.get('/comments/count/:receiver_id', authenticate, async (req, res) => {
  try {
    const receiverId = req.params.receiver_id;

    const count = await Comment.count({
      where: { receiver_id: receiverId }
    });

    res.status(200).json({ count });
  } catch (error) {
    console.error('Error counting comments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
