module.exports = (sequelize, DataTypes) => {
    const SPTransaction = sequelize.define('SPTransaction', {
      userId: DataTypes.INTEGER,
      amount: DataTypes.INTEGER,
      type: DataTypes.STRING,
      description: DataTypes.STRING
    });
    return SPTransaction;
  };