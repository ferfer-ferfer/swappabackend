module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    ID_notification: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    message: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    }
  }, {
    tableName: 'notifications',  // lowercase plural is common convention
    timestamps: false,            // if you don't want Sequelize auto timestamps
  })

  return Notification;
};
