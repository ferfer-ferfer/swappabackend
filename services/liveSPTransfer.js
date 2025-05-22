const { Class, User } = require('../models');

const startLiveSPTransfer = () => {
  setInterval(async () => {
    try {
      const activeClasses = await Class.findAll({ where: { is_active: true } });

      for (const session of activeClasses) {
        if (session.is_paused) continue; // Skip paused sessions

        const now = new Date();
        const start = new Date(session.start_time);
        const lastUpdate = new Date(session.last_sp_update || start);
        const minutesElapsed = Math.floor((now - lastUpdate) / (1000 * 60));

        if (minutesElapsed >= 5) {
          const student = await User.findByPk(session.sender_id);
          const teacher = await User.findByPk(session.reciver_id);

          if (!student || !teacher) continue;

          if (student.SP > 0) {
            // Transfer 1 SP
            student.SP -= 1;
            teacher.SP += 1;
            await student.save();
            await teacher.save();

            // Update session stats
            session.SP_N_P += 1;
            session.last_sp_update = new Date();
            await session.save();

            console.log(`[SP Transfer] 1 SP moved from student ${student.ID_Users} to teacher ${teacher.ID_Users}`);
          }

          // If student is out of SP, pause the session
          session.is_active = false;
            session.is_paused = true;
            session.end_time = new Date();
            await session.save();

            console.log(`[Class Stopped] Class ${session.ID_Class} stopped — student ${student.ID_Users} has no more SP.`);
          
        }
      }
    } catch (err) {
      console.error('[Live SP Transfer Error]', err);
    }
  }, 60 * 1000); // Run check every 1 minute
};

module.exports = startLiveSPTransfer;
 