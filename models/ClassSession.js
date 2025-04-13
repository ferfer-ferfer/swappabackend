module.exports = (sequelize, DataTypes) => {
    const ClassSession = sequelize.define('ClassSession', {
        sessionId: { 
            type: DataTypes.INTEGER, 
            primaryKey: true, 
            autoIncrement: true 
          },
      teacherId: DataTypes.INTEGER,
      studentId: DataTypes.INTEGER,
      skillId: DataTypes.INTEGER,
      teacherReady: { type: DataTypes.BOOLEAN, defaultValue: false },
      studentReady: { type: DataTypes.BOOLEAN, defaultValue: false },
      startTime: DataTypes.DATE,
      endTime: DataTypes.DATE,
      duration: DataTypes.INTEGER, // in minutes
      spEarned: DataTypes.INTEGER
    });
    return ClassSession;
  };