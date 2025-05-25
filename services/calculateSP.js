const { User, UserActivity } = require('../models');


const calculateSP = async (userId, activity) => {
  let spEarned = 0;
  const hours = activity.value;

  if (activity.type === 'profile-completion') {
    spEarned = 5;

  } else if (activity.type === 'teaching') {
    if (hours === 0.25) {
      spEarned = 1; // 15 minutes
    } else if (hours === 4) {
      spEarned = 4; // 4 hours bonus
    } else if (hours === 12) {
      spEarned = 9; // 12 hours bonus
    } else if (hours >= 4 && activity.timeFrame === 'day') {
      spEarned = 10; // Teaching 4h in one day
    } else if (hours >= 15 && activity.timeFrame === 'week') {
      spEarned = 15; // Teaching 15h in one week
    }

    // General rate always applies
    spEarned += 7 * hours;

  } else if (activity.type === 'learning') {
    spEarned = 7 * hours; // General rate for learning

  } else if (activity.type === 'applications') {
    if (activity.value >= 5) {
      spEarned = 3; // Accepting 5 requests
    }

  } else if (activity.type === 'skills') {
    const skills = activity.value;
    if (skills >= 3) {
      spEarned = 6; // Teaching 3 different skills
    }
  }

  try {
    // Save the activity
    await UserActivity.create({
      userId,
      activityType: activity.type,
      value: activity.value,
      spEarned,
    });

    // Fetch and update user stats
    const user = await User.findByPk(userId);

    
    if (user) {
      user.SP += spEarned;

      // Update time counters
      if (activity.type === 'teaching') {
        user.total_time_teaching_h += hours;
      } 
      else if (activity.type === 'learning') {
        user.total_time_learning_h += hours;
      }

      await user.save();
    }
  } catch (error) {
    console.error("Error in SP calculation:", error);
  }

  return spEarned;
};

module.exports = calculateSP;
