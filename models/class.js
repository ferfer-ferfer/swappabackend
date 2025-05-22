// models/class.js
module.exports = (sequelize, DataTypes) => {
    const Class = sequelize.define('class', {
      ID_class: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      request_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      reciver_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      start_time: {
        type: DataTypes.DATE
      },
      end_time: {
        type: DataTypes.DATE
      },
      SP_N_P: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      is_teacher_ready: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      is_student_ready: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      is_paused:{
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    }, {
      tableName: 'class',
      timestamps: true
    });
  
    return Class;
  };