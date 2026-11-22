import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordHash,verifyPassword,tokenFor,validString,okId} from '../src/security.js';
test('S01 scrypt password verification rejects wrong password',()=>{const h=passwordHash('ExamplePassword123!');assert.equal(verifyPassword('ExamplePassword123!',h),true);assert.equal(verifyPassword('wrong',h),false);});
test('S02 no weak or missing signing secret accepted',()=>{const old=process.env.AUTH_SECRET;process.env.AUTH_SECRET='short';assert.throws(()=>tokenFor({id:'u1',role:'listener'}));if(old===undefined)delete process.env.AUTH_SECRET;else process.env.AUTH_SECRET=old;});
test('S03 input rejects invalid note title',()=>{assert.equal(validString('',150),false);assert.equal(validString('a'.repeat(151),150),false);});
test('S04 episode identifiers limited to safe characters',()=>{assert.equal(okId('../etc/passwd'),false);assert.equal(okId('sample-01'),true);});
