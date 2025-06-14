const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Conversation = sequelize.define('Conversation', {
    conversationId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    userId: {
      type: DataTypes.STRING, // Optional, for future authentication
      allowNull: true
    },
    messages: {
      type: DataTypes.JSON, // Store messages as JSON array
      allowNull: false,
      defaultValue: []
    }
  }, {
    timestamps: true
  });

  return Conversation;
};