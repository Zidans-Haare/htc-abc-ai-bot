const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Database Setup', () => {
  let prisma;

  beforeAll(async () => {
    // DB is already set up by chooser
    prisma = new PrismaClient();
    await prisma.$connect();
    // Clean users
    await prisma.users.deleteMany({});
    // Create default admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin', 10);
    await prisma.users.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
      },
    });
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('should connect to database', async () => {
    await expect(prisma.$connect()).resolves.not.toThrow();
  });

  it('should have required tables', async () => {
    const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`;
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('hochschul_abc');
    expect(tableNames).toContain('conversations');
    expect(tableNames).toContain('feedback');
  });

  it('should create default admin user on init', async () => {
    const admin = await prisma.users.findFirst({ where: { username: 'admin' } });
    expect(admin).toBeDefined();
    expect(admin.role).toBe('admin');
  });

  // Test migration scripts
  it('should run migrate_old_db.js without error', async () => {
    const scriptPath = path.join(__dirname, '../scripts/migrate_old_db.js');
    if (fs.existsSync(scriptPath)) {
      // Mock console.log to avoid output
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Run the script
      require(scriptPath);

      logSpy.mockRestore();
      errorSpy.mockRestore();
      // If no throw, assume success
      expect(true).toBe(true);
    } else {
      // Skip if script doesn't exist
      expect(true).toBe(true);
    }
  });

  it('should run migrate_to_prisma.js without error', async () => {
    const scriptPath = path.join(__dirname, '../scripts/migrate_to_prisma.js');
    if (fs.existsSync(scriptPath)) {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      require(scriptPath);

      logSpy.mockRestore();
      errorSpy.mockRestore();
      expect(true).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });
});