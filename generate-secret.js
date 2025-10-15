// Simple script to generate a secure JWT secret
// Run with: node generate-secret.js

import crypto from 'crypto';

const secret = crypto.randomBytes(32).toString('hex');

console.log('\n=================================');
console.log('Generated JWT Secret:');
console.log('=================================');
console.log(secret);
console.log('=================================\n');
console.log('Copy this value and paste it in your .env file as JWT_SECRET');
console.log('\n');
