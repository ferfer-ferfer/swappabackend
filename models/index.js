require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

// DB connection
const sequelize = new Sequelize(
  process.env.DB_DATABASE,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: false,
    dialectOptions: {
      connectTimeout: 10000
    }
  }
);

// Import models
const User = require('./User')(sequelize, DataTypes);
const Skill = require('./Skill')(sequelize, DataTypes);
const ClassSession = require('./ClassSession')(sequelize, DataTypes);
const SPTransaction = require('./SPTransaction')(sequelize, DataTypes);

// User <-> Skill many-to-many
User.belongsToMany(Skill, { through: 'UserSkills' });
Skill.belongsToMany(User, { through: 'UserSkills' });

// ClassSession associations
ClassSession.belongsTo(User, { as: 'teacher', foreignKey: 'teacherId' });
ClassSession.belongsTo(User, { as: 'student', foreignKey: 'studentId' });
User.hasMany(ClassSession, { as: 'taughtClasses', foreignKey: 'teacherId' });
User.hasMany(ClassSession, { as: 'learnedClasses', foreignKey: 'studentId' });

// SPTransaction association
SPTransaction.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(SPTransaction, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  Sequelize,
  DataTypes,
  User,
  Skill,
  ClassSession,
  SPTransaction
};
