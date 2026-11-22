import 'dotenv/config';
import {db} from './store.js';
const email=process.argv[2]?.toLowerCase();
if(!email){console.error('Usage: node src/promote-admin.js email@example.com');process.exit(1);}
const user=(await db.all('users')).find(u=>u.email===email);
if(!user){console.error('User not found. Register first.');process.exit(1);}
user.role='admin';await db.put('users',user);
console.log(`Promoted ${email} to admin. Sign in again for a new token.`);
