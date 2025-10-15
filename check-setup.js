// Setup verification script
// Run with: node check-setup.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🔍 Checking BloomTrack Setup...\n');

let hasErrors = false;

// Check 1: .env file exists
console.log('1. Checking .env file...');
if (fs.existsSync('.env')) {
  console.log('   ✅ .env file exists');
  
  // Read and check .env contents
  const envContent = fs.readFileSync('.env', 'utf8');
  
  if (envContent.includes('your_neon_postgresql_connection_string_here')) {
    console.log('   ⚠️  WARNING: DATABASE_URL not configured');
    console.log('      Please update DATABASE_URL with your Neon connection string');
    hasErrors = true;
  } else {
    console.log('   ✅ DATABASE_URL appears to be configured');
  }
  
  if (envContent.includes('your_secure_random_secret_key_here')) {
    console.log('   ⚠️  WARNING: JWT_SECRET not configured');
    console.log('      Run: node generate-secret.js to generate a secret');
    hasErrors = true;
  } else {
    console.log('   ✅ JWT_SECRET appears to be configured');
  }
} else {
  console.log('   ❌ .env file not found');
  console.log('      Copy .env.example to .env and configure it');
  hasErrors = true;
}

// Check 2: node_modules
console.log('\n2. Checking dependencies...');
if (fs.existsSync('node_modules')) {
  console.log('   ✅ node_modules exists');
  
  // Check for key dependencies
  const requiredDeps = ['express', 'pg', 'bcrypt', 'jsonwebtoken', 'cors'];
  let missingDeps = [];
  
  requiredDeps.forEach(dep => {
    if (!fs.existsSync(path.join('node_modules', dep))) {
      missingDeps.push(dep);
    }
  });
  
  if (missingDeps.length > 0) {
    console.log('   ⚠️  Missing dependencies:', missingDeps.join(', '));
    console.log('      Run: npm install');
    hasErrors = true;
  } else {
    console.log('   ✅ All required dependencies installed');
  }
} else {
  console.log('   ❌ node_modules not found');
  console.log('      Run: npm install');
  hasErrors = true;
}

// Check 3: Server files
console.log('\n3. Checking server files...');
const serverFiles = [
  'server/index.ts',
  'server/db.ts',
  'server/middleware/auth.ts',
  'server/routes/auth.ts',
  'server/routes/profiles.ts',
  'server/routes/sellers.ts'
];

let allServerFilesExist = true;
serverFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`   ❌ Missing: ${file}`);
    allServerFilesExist = false;
    hasErrors = true;
  }
});

if (allServerFilesExist) {
  console.log('   ✅ All server files present');
}

// Check 4: Database schema
console.log('\n4. Checking database schema...');
if (fs.existsSync('database/schema.sql')) {
  console.log('   ✅ Database schema file exists');
  console.log('      Remember to run this in your Neon SQL Editor!');
} else {
  console.log('   ❌ database/schema.sql not found');
  hasErrors = true;
}

// Check 5: Frontend API client
console.log('\n5. Checking frontend API client...');
if (fs.existsSync('src/lib/api.ts')) {
  console.log('   ✅ API client exists');
} else {
  console.log('   ❌ src/lib/api.ts not found');
  hasErrors = true;
}

// Check 6: Package.json scripts
console.log('\n6. Checking package.json scripts...');
if (fs.existsSync('package.json')) {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (packageJson.scripts && packageJson.scripts['server:dev']) {
    console.log('   ✅ Server scripts configured');
  } else {
    console.log('   ⚠️  Server scripts not found in package.json');
    hasErrors = true;
  }
} else {
  console.log('   ❌ package.json not found');
  hasErrors = true;
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('⚠️  SETUP INCOMPLETE - Please fix the issues above');
  console.log('\nQuick fixes:');
  console.log('1. Run: npm install');
  console.log('2. Copy .env.example to .env and configure it');
  console.log('3. Run: node generate-secret.js to get a JWT secret');
  console.log('4. Create Neon database and run database/schema.sql');
  console.log('\nSee SETUP_INSTRUCTIONS.md for detailed guide');
} else {
  console.log('✅ SETUP LOOKS GOOD!');
  console.log('\nNext steps:');
  console.log('1. Ensure your Neon database schema is created');
  console.log('2. Terminal 1: npm run server:dev');
  console.log('3. Terminal 2: npm run dev');
  console.log('\nSee TESTING_GUIDE.md for testing instructions');
}
console.log('='.repeat(50) + '\n');

process.exit(hasErrors ? 1 : 0);
