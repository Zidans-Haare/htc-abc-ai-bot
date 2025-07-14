const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('./db.cjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'editor'
  }
}, {
  tableName: 'users',
  timestamps: false
});

async function init() {
  await sequelize.sync({ alter: true });
}

async function verifyUser(username, password) {
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) return null;
    const match = await bcrypt.compare(password, user.password);
    if (!match) return null;
    return { username: user.username, role: user.role };
  } catch (err) {
    console.error('Verify user error:', err);
    throw err;
  }
}

async function createUser(username, password, role) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword, role });
    return { id: user.id, username: user.username, role: user.role };
  } catch (err) {
    console.error('Create user error:', err);
    throw err;
  }
}

async function listUsers() {
  try {
    const users = await User.findAll({ attributes: ['id', 'username', 'role'] });
    return users;
  } catch (err) {
    console.error('List users error:', err);
    throw err;
  }
}

async function updateUserPassword(username, newPassword) {
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.update({ password: hashedPassword }, { where: { username } });
  } catch (err) {
    console.error('Update user password error:', err);
    throw err;
  }
}

async function deleteUser(username) {
  try {
    await User.destroy({ where: { username } });
  } catch (err) {
    console.error('Delete user error:', err);
    throw err;
  }
}

module.exports = { init, verifyUser, createUser, listUsers, updateUserPassword, deleteUser };