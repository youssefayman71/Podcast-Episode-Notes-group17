import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {randomUUID} from 'node:crypto';
import {db} from './store.js';
import {auth,adminOnly,passwordHash,verifyPassword,tokenFor,validString,okId} from './security.js';
export const app=express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
    origin: (origin, cb) => {
        const allowed = (process.env.CORS_ORIGINS || 'http://localhost:8080,http://localhost:3000,http://localhost:5500').split(',');
        cb(null, !origin || allowed.includes(origin));
    }
}));
app.use(express.json({ limit: '20kb' }));
app.use((req,res,next)=>{req.requestId=randomUUID();res.set('X-Request-ID',req.requestId);let start=Date.now();res.on('finish',()=>console.log(JSON.stringify({requestId:req.requestId,method:req.method,path:req.path,status:res.statusCode,ms:Date.now()-start})));next();});
// Each Lambda sets COMPONENT=discovery|notes|library to reject other components' routes.
// For local development, omit COMPONENT so one Express server provides all three.
app.use('/api/v1',(req,res,next)=>{
 const c=process.env.COMPONENT;
 if(!c||req.path==='/health')return next();
 const matching=req.path.startsWith('/episodes')||req.path.startsWith('/admin/episodes')?'discovery':req.path.startsWith('/notes')?'notes':'library';
 if(matching!==c)return res.status(404).json({error:'Route not found in this service'});
 next();
});
const route=express.Router();app.use('/api/v1',route);
const now=()=>new Date().toISOString();
const fail=(res,code,message)=>res.status(code).json({error:message});
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const owner=(rows,u)=>rows.filter(x=>x.userId===u);
const episodeInput=(body)=>({episodeId:body.episodeId,title:body.title,podcast:body.podcast||'',durationMs:Number(body.durationMs)||0});
const episodeValid=e=>okId(e.episodeId)&&validString(e.title,250)&&(!e.podcast||validString(e.podcast,250))&&Number.isSafeInteger(e.durationMs)&&e.durationMs>=0;

route.get('/health',(_req,res)=>res.json({status:'ok',service:'podcast-notes'}));
route.post('/auth/register',wrap(async(req,res)=>{let {email,password}=req.body||{};if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||email.length>200||typeof password!=='string'||password.length<12||password.length>200)return fail(res,400,'Valid email and password (12-200 chars) required');email=email.toLowerCase().trim();if((await db.all('users')).some(u=>u.email===email))return fail(res,409,'Email already registered');const user=await db.put('users',{id:randomUUID(),email,passwordHash:passwordHash(password),role:'listener',createdAt:now()});return res.status(201).json({id:user.id,email:user.email,role:user.role});}));
route.post('/auth/login',wrap(async(req,res)=>{const {email,password}=req.body||{};if(!validString(email,200)||typeof password!=='string')return fail(res,400,'Credentials required');const user=(await db.all('users')).find(u=>u.email===email.toLowerCase().trim());if(!user||!verifyPassword(password,user.passwordHash))return fail(res,401,'Invalid credentials');res.json({token:tokenFor(user),role:user.role});}));
route.get('/me',auth,wrap(async(req,res)=>{const u=await db.get('users',req.user.id);if(!u)return fail(res,401,'Unknown user');res.json({id:u.id,email:u.email,role:u.role});}));
// Discovery owned by Youssef. External iTunes API is material: library and notes need episode metadata.
route.get('/episodes/search',wrap(async(req,res)=>{const q=req.query.q;if(!validString(q,90)||q.length<2)return fail(res,400,'Search requires 2-90 characters');const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),6000);try{const url=new URL('https://itunes.apple.com/search');url.searchParams.set('term',q);url.searchParams.set('entity','podcastEpisode');url.searchParams.set('limit','20');const r=await fetch(url,{signal:ctl.signal});if(!r.ok)return fail(res,502,'Episode provider unavailable');const body=await r.json();if(!Array.isArray(body.results))return fail(res,502,'Invalid provider response');let items=body.results.filter(x=>x.trackId&&x.trackName&&x.trackTimeMillis>0).map(x=>({episodeId:String(x.trackId),title:x.trackName,podcast:x.collectionName||'',durationMs:x.trackTimeMillis,publisher:x.artistName||'',url:x.trackViewUrl||''}));return res.json({results:items,count:items.length});}catch{return fail(res,502,'Episode provider unavailable');}finally{clearTimeout(timeout);}}));
route.post('/episodes/import',auth,wrap(async(req,res)=>{const ep=episodeInput(req.body||{});if(!episodeValid(ep))return fail(res,400,'Valid episode ID/title/duration required');let old=await db.get('episodes',ep.episodeId);if(old){return res.json({episode:old,alreadyImported:true});}let e=await db.put('episodes',{id:ep.episodeId,...ep,createdAt:now(),reviewStatus:'approved'});return res.status(201).json({episode:e,alreadyImported:false});}));
route.get('/episodes/:id',wrap(async(req,res)=>{const e=await db.get('episodes',req.params.id);if(!e)return fail(res,404,'Episode not found');res.json(e);}));
route.get('/episodes/:id/eligibility',auth,wrap(async(req,res)=>{const e=await db.get('episodes',req.params.id);if(!e)return fail(res,404,'Episode not found');let mine=owner(await db.all('library'),req.user.id).find(x=>x.episodeId===e.id);res.json({canCreateNote:e.reviewStatus==='approved'&&!!mine,reason:e.reviewStatus!=='approved'?'Episode not approved':!mine?'Save episode to your library first':null});}));
route.patch('/admin/episodes/:id/review',auth,adminOnly,wrap(async(req,res)=>{if(!['approved','blocked'].includes(req.body?.status))return fail(res,400,'status must be approved or blocked');const e=await db.get('episodes',req.params.id);if(!e)return fail(res,404,'Episode not found');e.reviewStatus=req.body.status;await db.put('episodes',e);res.json(e);}));
// Library and tags owned by Anas; all entries scoped to the authenticated user.
route.get('/library',auth,wrap(async(req,res)=>res.json(owner(await db.all('library'),req.user.id))));
route.post('/library',auth,wrap(async(req,res)=>{const {episodeId}=req.body||{};if(!okId(episodeId))return fail(res,400,'episodeId required');const ep=await db.get('episodes',episodeId);if(!ep)return fail(res,404,'Import episode before saving');const entryId=`${req.user.id}_${episodeId}`;if(await db.get('library',entryId))return fail(res,409,'Episode already saved');const entry=await db.put('library',{id:entryId,userId:req.user.id,episodeId,progressMs:0,status:'planned',savedAt:now()});res.status(201).json(entry);}));
route.patch('/library/:episodeId/progress',auth,wrap(async(req,res)=>{const entry=await db.get('library',`${req.user.id}_${req.params.episodeId}`);if(!entry)return fail(res,404,'Saved episode not found');const ep=await db.get('episodes',entry.episodeId);const value=req.body?.progressMs;if(!Number.isSafeInteger(value)||value<0||value>ep.durationMs)return fail(res,400,'Progress must be between 0 and episode duration');entry.progressMs=value;entry.status=value===ep.durationMs?'completed':value>0?'in-progress':'planned';entry.updatedAt=now();await db.put('library',entry);res.json(entry);}));
route.delete('/library/:episodeId',auth,wrap(async(req,res)=>{const id=`${req.user.id}_${req.params.episodeId}`;if(!await db.get('library',id))return fail(res,404,'Saved episode not found');await db.del('library',id);res.status(204).end();}));
route.get('/library/stats/summary',auth,wrap(async(req,res)=>{const rows=owner(await db.all('library'),req.user.id);res.json({saved:rows.length,completed:rows.filter(x=>x.status==='completed').length,inProgress:rows.filter(x=>x.status==='in-progress').length});}));
route.get('/tags',auth,wrap(async(req,res)=>res.json(owner(await db.all('tags'),req.user.id))));
route.post('/tags',auth,wrap(async(req,res)=>{const name=req.body?.name;if(!validString(name,35))return fail(res,400,'Tag name required (max 35)');if(owner(await db.all('tags'),req.user.id).some(x=>x.name.toLowerCase()===name.trim().toLowerCase()))return fail(res,409,'Tag already exists');res.status(201).json(await db.put('tags',{userId:req.user.id,name:name.trim()}));}));
route.patch('/tags/:id',auth,wrap(async(req,res)=>{const t=await db.get('tags',req.params.id);if(!t||t.userId!==req.user.id)return fail(res,404,'Tag not found');if(!validString(req.body?.name,35))return fail(res,400,'Invalid tag name');if(owner(await db.all('tags'),req.user.id).some(x=>x.id!==t.id&&x.name.toLowerCase()===req.body.name.trim().toLowerCase()))return fail(res,409,'Tag already exists');t.name=req.body.name.trim();await db.put('tags',t);res.json(t);}));
route.delete('/tags/:id',auth,wrap(async(req,res)=>{const t=await db.get('tags',req.params.id);if(!t||t.userId!==req.user.id)return fail(res,404,'Tag not found');await db.del('tags',t.id);for(const row of owner(await db.all('notes'),req.user.id)){if(row.tagIds?.includes(t.id)){row.tagIds=row.tagIds.filter(id=>id!==t.id);await db.put('notes',row);}}res.status(204).end();}));
// Notes owned by Steven. Real rules: must be in library, timestamp within duration, reviewed workflow.
route.get('/notes',auth,wrap(async(req,res)=>{let notes=owner(await db.all('notes'),req.user.id);if(req.query.q){if(!validString(req.query.q,100))return fail(res,400,'Invalid query');const q=req.query.q.toLowerCase();notes=notes.filter(n=>n.title.toLowerCase().includes(q)||n.body.toLowerCase().includes(q));}if(req.query.tagId)notes=notes.filter(n=>n.tagIds?.includes(req.query.tagId));res.json(notes.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));}));
async function validatedNote(req,res,existing){const {episodeId,title,body,timestampMs,tagIds=[]}=req.body||{};const ep=await db.get('episodes',existing?.episodeId||episodeId);if(!ep)return {error:fail(res,404,'Episode not found')};if(ep.reviewStatus!=='approved')return {error:fail(res,403,'Episode blocked')};if(!await db.get('library',`${req.user.id}_${ep.id}`))return {error:fail(res,409,'Save episode to library first')};const ts=timestampMs===undefined&&existing?existing.timestampMs:timestampMs;const ttl=title===undefined&&existing?existing.title:title;const txt=body===undefined&&existing?existing.body:body;const tags= req.body?.tagIds===undefined&&existing?existing.tagIds:tagIds;if(!validString(ttl,150)||!validString(txt,4000)||!Number.isSafeInteger(ts)||ts<0||ts>ep.durationMs||!Array.isArray(tags)||tags.length>8||!tags.every(okId))return {error:fail(res,400,'Invalid title/body/timestamp/tags')};for(const id of tags){const tag=await db.get('tags',id);if(!tag||tag.userId!==req.user.id)return {error:fail(res,400,'Tag not owned by user')};}return {value:{episodeId:ep.id,title:ttl.trim(),body:txt.trim(),timestampMs:ts,tagIds:[...new Set(tags)]}};}
route.post('/notes',auth,wrap(async(req,res)=>{const checked=await validatedNote(req,res);if(checked.error)return;const item=await db.put('notes',{userId:req.user.id,...checked.value,status:'draft',createdAt:now(),updatedAt:now()});res.status(201).json(item);}));
route.patch('/notes/:id',auth,wrap(async(req,res)=>{const item=await db.get('notes',req.params.id);if(!item||item.userId!==req.user.id)return fail(res,404,'Note not found');if(item.status==='reviewed')return fail(res,409,'Reopen reviewed note before editing');const checked=await validatedNote(req,res,item);if(checked.error)return;Object.assign(item,checked.value,{updatedAt:now()});await db.put('notes',item);res.json(item);}));
route.patch('/notes/:id/status',auth,wrap(async(req,res)=>{const item=await db.get('notes',req.params.id);if(!item||item.userId!==req.user.id)return fail(res,404,'Note not found');const status=req.body?.status;if(!['draft','reviewed'].includes(status)||status===item.status)return fail(res,400,'Use a valid different status');item.status=status;item.updatedAt=now();await db.put('notes',item);res.json(item);}));
route.delete('/notes/:id',auth,wrap(async(req,res)=>{const item=await db.get('notes',req.params.id);if(!item||item.userId!==req.user.id)return fail(res,404,'Note not found');await db.del('notes',item.id);res.status(204).end();}));
app.use((req,res)=>fail(res,404,'Route not found'));
app.use((err,req,res,next)=>{console.error(JSON.stringify({requestId:req.requestId,errorType:err.name||'Error'}));if(err instanceof SyntaxError&&err.status===400)return fail(res,400,'Invalid JSON');if(err.type==='entity.too.large')return fail(res,413,'Body too large');return fail(res,500,'Internal server error');});
