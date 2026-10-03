const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const scope=vm.createContext({TextEncoder,btoa});
const mime=fs.readFileSync(__dirname+'/../supabase/functions/order-mail/mime.ts','utf8').replace('export function','function');
vm.runInContext(stripTypeScriptTypes(mime),scope);
const source=fs.readFileSync(__dirname+'/../supabase/functions/order-mail/index.ts','utf8');
vm.runInContext(stripTypeScriptTypes(source.slice(source.indexOf('const esc'),source.indexOf('Deno.serve'))),scope);
test('Both MIME alternatives round trip UTF-8 exactly, with valid 76-byte base64 lines',()=>{
 for(const lang of ['sr','de','en'])for(const kind of ['welcome','proposal','insp_report']) {
  scope.lead={lang,name:'Željko Čović',model:'Golf 7',token:'aaaaaaaaaaaaaaaaaaaaaaaa'};scope.kind=kind;
  const message=vm.runInContext('compose(kind,lead,{title:"Škoda",inspNote:"Oštećenje: čćšđž – €"},null)',scope);
  scope.text=message.text;scope.html=message.html;
  const parts=vm.runInContext('mailParts(text,html).mimeContent',scope);
  assert.equal(parts.length,2);
  parts.forEach((p,i)=>{assert.equal(p.transferEncoding,'base64');assert.ok(p.mimeType.includes('utf-8'));assert.equal(Buffer.from(p.content,'base64').toString('utf8'),i?message.html:message.text);assert.ok(p.content.split('\r\n').every(l=>l.length<=76));});
 }
});
test('All SMTP send paths use the verified UTF-8 encoder',()=>{assert.equal((source.match(/client\.send\(/g)||[]).length,(source.match(/\.\.\.mailParts\(/g)||[]).length);});
test('Welcome directs additions to the request conversation',()=>{scope.lead={lang:'sr',name:'Test',model:'Golf',token:'aaaaaaaaaaaaaaaaaaaaaaaa'};const m=vm.runInContext('compose("welcome",lead,{},null)',scope);assert.ok(m.text.includes('koristite razgovor u svom upitu'));assert.ok(!m.text.includes('odgovorite na ovaj mejl'));});
