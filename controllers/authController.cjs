const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('./db.cjs');

const AdminUser = sequelize.define('AdminUser', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING, unique: true },
  passwordHash: { type: DataTypes.STRING }
}, { tableName: 'admin_users', timestamps: false });

async function init() {
  await AdminUser.sync();
  const count = await AdminUser.count();
  if (count === 0) {
    await AdminUser.create({ username: 'admin', passwordHash: hash('admin') });
  }
}

function hash(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function verifyUser(username, password) {
  const user = await AdminUser.findOne({ where: { username } });
  if (!user) return false;
  return user.passwordHash === hash(password);
}

module.exports = { AdminUser, init, verifyUser, hash };
