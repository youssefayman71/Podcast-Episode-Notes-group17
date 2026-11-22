const { DatabaseSync } = process.env.STORE === 'dynamo'
  ? { DatabaseSync: null }
  : await import('node:sqlite');
  
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

// Local persistent SQLite; on Floci, select STORE=dynamo and individual DynamoDB tables.
const tables = ['users','episodes','notes','library','tags','noteTags'];
let sqlite;
let dynamo;
const names = Object.fromEntries(tables.map(t=>[t, `${process.env.TABLE_PREFIX || 'podcast'}-${t}`]));
function local() {
 if (!sqlite) {
   sqlite = new DatabaseSync(process.env.SQLITE_PATH || './podcast.db');
   sqlite.exec('PRAGMA journal_mode = WAL');
   for (const t of tables) sqlite.exec(`CREATE TABLE IF NOT EXISTS "${t}" (id TEXT PRIMARY KEY, payload TEXT NOT NULL)`);
 }
 return sqlite;
}
function remote(){
 if(!dynamo) dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({
  region:process.env.AWS_REGION||'us-east-1',
  ...(process.env.AWS_ENDPOINT_URL?{endpoint:process.env.AWS_ENDPOINT_URL}:{}),
  ...(process.env.AWS_ENDPOINT_URL?{credentials:{accessKeyId:'test',secretAccessKey:'test'}}:{})
 }));
 return dynamo;
}
export const db = {
 async get(t,id){if(!tables.includes(t))throw Error('invalid table');if(process.env.STORE==='dynamo'){let r=await remote().send(new GetCommand({TableName:names[t],Key:{id}}));return r.Item?.data||null;}let r=local().prepare(`SELECT payload FROM "${t}" WHERE id=?`).get(id);return r?JSON.parse(r.payload):null;},
 async put(t,item){if(!tables.includes(t))throw Error('invalid table');item.id ||= randomUUID(); if(process.env.STORE==='dynamo')await remote().send(new PutCommand({TableName:names[t],Item:{id:item.id,data:item}}));else local().prepare(`INSERT INTO "${t}" (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload`).run(item.id,JSON.stringify(item));return item;},
 async del(t,id){if(!tables.includes(t))throw Error('invalid table');if(process.env.STORE==='dynamo')await remote().send(new DeleteCommand({TableName:names[t],Key:{id}}));else local().prepare(`DELETE FROM "${t}" WHERE id=?`).run(id);},
 async all(t){if(!tables.includes(t))throw Error('invalid table');if(process.env.STORE==='dynamo'){let out=[],key;do{let r=await remote().send(new ScanCommand({TableName:names[t],ExclusiveStartKey:key}));out.push(...(r.Items||[]).map(v=>v.data));key=r.LastEvaluatedKey;}while(key);return out;}return local().prepare(`SELECT payload FROM "${t}"`).all().map(x=>JSON.parse(x.payload));}
};
