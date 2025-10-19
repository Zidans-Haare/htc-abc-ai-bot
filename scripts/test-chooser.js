const readline = require('readline');
const { exec, execSync } = require('child_process');
const dotenv = require('dotenv');
const fs = require('fs');

// Check for --env flag
const envIndex = process.argv.indexOf('--env');
let envFileFromFlag = null;
if (envIndex !== -1 && envIndex + 1 < process.argv.length) {
  envFileFromFlag = process.argv[envIndex + 1];
}

let rl;

if (envFileFromFlag) {
  // Use the flag value directly
  runTests(envFileFromFlag);
} else {
  // Prompt for input
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let timeoutId = setTimeout(() => {
    console.log('\nNo choice made within 10 seconds. Defaulting to .env.test...');
    runTests('.env.test');
  }, 10000);

  rl.question('Choose environment for tests:\n1. .env (production config - may fail if optional deps not mocked)\n2. .env.test (recommended for testing)\nEnter 1 or 2 (defaults to .env.test in 10s): ', (answer) => {
    clearTimeout(timeoutId);
    let envFile;
    if (answer === '1') {
      envFile = '.env';
    } else if (answer === '2') {
      envFile = '.env.test';
    } else if (answer.trim() === '') {
      envFile = '.env.test';
    } else {
      console.log('Invalid choice. Defaulting to .env.test.');
      envFile = '.env.test';
    }

    runTests(envFile);
  });
}

function runTests(envFile) {
  console.log(`Running tests with ${envFile}...`);
  // Temporarily rename .env to .env.backup to prevent loading it
  const envBackup = '.env.backup';
  if (fs.existsSync('.env')) {
    fs.renameSync('.env', envBackup);
  }
  // Load the env file into process.env
  dotenv.config({ path: envFile, override: true });
  // Set DATABASE_URL based on MAIN_DB_TYPE and MAIN_DB_PATH
  if (process.env.MAIN_DB_TYPE === 'sqlite') {
    process.env.DATABASE_URL = `file:${process.env.MAIN_DB_PATH}`;
  } else if (process.env.MAIN_DB_TYPE === 'postgresql') {
    // Assume standard format, but for test, set a test one
    process.env.DATABASE_URL = `postgresql://user:pass@localhost:5432/testdb`;
  } else if (process.env.MAIN_DB_TYPE === 'mysql') {
    process.env.DATABASE_URL = `mysql://user:pass@localhost:3306/testdb`;
  }
  // Push schema to DB to create tables
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  // Now exec npm run test:direct with the env set
  exec(`npm run test:direct`, (error, stdout, stderr) => {
    console.log(stdout);
    if (stderr) console.error(stderr);
    if (error) console.error('Error:', error);
    // Restore .env
    if (fs.existsSync(envBackup)) {
      fs.renameSync(envBackup, '.env');
    }
    if (rl) rl.close();
  });
}