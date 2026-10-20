const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(require.resolve('../browser-reader-extension/'+name),'utf8');
function worker(){let connect;const context={URL,console,chrome:{runtime:{onConnect:{addListener:fn=>connect=fn}},tabs:{create:async()=>{throw Error('controlled_stop');},update:async()=>{}}}};vm.createContext(context);vm.runInContext(read('background.js').replace(/^import .*;\r?\n/gm,''),context);return connect;}
function port(sender){const posts=[];let message,disconnected=false;return {name:'swiscars-read',sender,posts,onMessage:{addListener:fn=>message=fn},onDisconnect:{addListener(){}},postMessage:value=>posts.push(value),disconnect:()=>disconnected=true,send:value=>message?.(value),get disconnected(){return disconnected;}};}
test('a valid team iframe can connect through its Chrome-provided URL when sender.origin is omitted',async()=>{
 const connect=worker(),p=port({url:'https://swiscars.com/intern/predlog-vozila/',tab:{id:1}});connect(p);await p.send({type:'read',url:'https://www.autoscout24.ch/de/d/audi-20851760'});
 assert.equal(p.posts[0].stage,'reader_connected');assert.equal(p.posts.at(-1).reason,'controlled_stop');assert.equal(p.disconnected,false);
});
test('origin fallback remains restricted to the exact team page or approved local preview',()=>{
 const connect=worker();for(const sender of [{url:'https://swiscars.com/other/'},{url:'https://attacker.invalid/intern/predlog-vozila/'},{url:'https://swiscars.com/intern/predlog-vozila/',origin:'https://attacker.invalid'},{url:'http://127.0.0.1:4193/other/'},{origin:'https://swiscars.com'}]){const p=port(sender);connect(p);assert.equal(p.posts[0]?.reason,'reader_source_rejected');}
 const local=port({url:'http://127.0.0.1:4193/predlog-kartice/?proba=upit'});connect(local);assert.equal(local.posts.length,0);
});
test('the bridge reports a missing worker precisely and clears the keepalive after a terminal response',()=>{
 const events={},posts=[],intervals=new Set();let onMessage,onDisconnect,workerMessage;
 const p={onMessage:{addListener:fn=>onMessage=fn},onDisconnect:{addListener:fn=>onDisconnect=fn},postMessage:m=>workerMessage=m,disconnect(){}};
 const context={document:{documentElement:{dataset:{}}},location:{origin:'https://swiscars.com'},chrome:{runtime:{getManifest:()=>({version:'0.2.1'}),connect:()=>p}},setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn)};context.window=context;context.addEventListener=(name,fn)=>events[name]=fn;context.postMessage=m=>posts.push(m);vm.createContext(context);vm.runInContext(read('bridge.js'),context);const page=vm.runInContext('window',context);
 events.message({source:page,origin:'https://swiscars.com',data:{source:'swiscars-card',type:'read',id:'one',url:'https://www.autoscout24.ch/de/d/audi-20851760'}});
 assert.equal(workerMessage?.type,'read');assert.equal(intervals.size,1);onMessage({type:'snapshot',snapshot:{title:'Audi'}});assert.equal(posts.at(-1).type,'snapshot');assert.equal(intervals.size,0);
 events.message({source:page,origin:'https://swiscars.com',data:{source:'swiscars-card',type:'read',id:'two',url:'https://www.autoscout24.ch/de/d/audi-20851760'}});context.chrome.runtime.lastError={message:'Could not establish connection. Receiving end does not exist.'};onDisconnect();assert.equal(posts.at(-1).reason,'reader_background_unavailable');assert.equal(intervals.size,0);
});
