// Run this integration test against a SEPARATE local test server (see docs/TESTING.md).
// Node's built-in runner uses API_TEST_URL if set. No secret is printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.API_TEST_URL;
const req=async(path,method='GET',body,token)=>{const response=await fetch(`${base}/api/v1${path}`,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{'authorization':`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:response.status===204?null:await response.json()};};
// Skip when no test server: NEVER claim integration tests passed by default.
test('integration: 10 independent app/security scenarios', {skip:!base},async()=>{
 const salt=randomUUID();const email1=`first-${salt}@example.test`,email2=`second-${salt}@example.test`;
 assert.equal((await req('/auth/register','POST',{email:email1,password:'ExampleSecure12345!'})).status,201);
 assert.equal((await req('/auth/register','POST',{email:email2,password:'ExampleSecure12345!'})).status,201);
 const a=(await req('/auth/login','POST',{email:email1,password:'ExampleSecure12345!'})).body.token;
 const b=(await req('/auth/login','POST',{email:email2,password:'ExampleSecure12345!'})).body.token;
 assert.equal((await req('/notes')).status,401); // S05 unauthenticated
 assert.equal((await req('/admin/episodes/nope/review','PATCH',{status:'blocked'},a)).status,403); // S06 non-admin
 assert.equal((await req('/auth/login','POST',{email:email1,password:'bad'})).status,401); // S07 bad login
 const ep='demo-'+salt;
 assert.equal((await req('/episodes/import','POST',{episodeId:ep,title:'Test episode',durationMs:60000},a)).status,201);
 assert.equal((await req('/notes','POST',{episodeId:ep,title:'Test',body:'Body',timestampMs:0},a)).status,409); // S08 must be saved
 assert.equal((await req('/library','POST',{episodeId:ep},a)).status,201);
 assert.equal((await req('/library','POST',{episodeId:ep},a)).status,409); // S09 duplicate
 assert.equal((await req(`/library/${ep}/progress`,'PATCH',{progressMs:60001},a)).status,400); // S10 timestamp validation
 assert.equal((await req('/notes','POST',{episodeId:ep,title:'Bad',body:'Body',timestampMs:60001},a)).status,400); // S11 note duration
 const note=(await req('/notes','POST',{episodeId:ep,title:'Valid',body:'Note body',timestampMs:20000},a));assert.equal(note.status,201);
 assert.equal((await req(`/notes/${note.body.id}`,'PATCH',{title:'Attempt from other user'},b)).status,404); // S12 ownership
 assert.equal((await req('/notes','GET',null,b)).body.length,0);
 assert.equal((await req(`/notes/${note.body.id}/status`,'PATCH',{status:'reviewed'},a)).status,200);
 assert.equal((await req(`/notes/${note.body.id}`,'PATCH',{title:'Should fail'},a)).status,409); // business workflow
 assert.equal((await req('/notes','GET',null,a)).body.length,1);
});
