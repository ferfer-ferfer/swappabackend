// models/User.js
module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
      email:{
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
    
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      firstName: {
        type: DataTypes.STRING,
      },
      lastName: {
        type: DataTypes.STRING,
      },
        age: {
          type: DataTypes.INTEGER,
        } 
      }, {
        tableName: 'user', 
      });
  
    return User;
  };
  
