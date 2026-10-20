import assert from 'node:assert/strict';
import {readCdpPage,classify,browserOptions} from '../netlify/functions/_shared/cloud-reader-runtime.mjs';

const url='https://www.autoscout24.ch/de/d/audi-rs3-20851760';
const checking={url,readyState:'complete',title:'Nur einen Moment…',heading:'Sicherstellung, dass Ihre Verbindung geschützt ist',text:'Wir führen eine schnelle Sicherheitsüberprüfung durch.',photos:[],cards:[]};
const listing={url,readyState:'complete',title:'AUDI RS3 Kaufen',heading:'AUDI RS3',text:"CHF 47'490.–\n73'500 km",photos:['https://listing-images.autoscout24.ch/vehicle.jpg'],cards:[]};

async function simulate(snapshots){
  let reads=0,clock=0,closed=false;
  const commands=[];
  class Socket{
    listeners=new Map();
    constructor(){queueMicrotask(()=>this.emit('open',{}));}
    addEventListener(name,listener){const list=this.listeners.get(name)||[];list.push(listener);this.listeners.set(name,list);}
    emit(name,event){for(const listener of this.listeners.get(name)||[])listener(event);}
    send(raw){
      const command=JSON.parse(raw);commands.push(command.method);
      let result={};
      if(command.method==='Target.createTarget')result={targetId:'test-tab'};
      if(command.method==='Target.attachToTarget')result={sessionId:'test-session'};
      if(command.method==='Runtime.evaluate'){
        const snapshot=snapshots[Math.min(reads++,snapshots.length-1)];clock+=5;
        result={result:{value:JSON.stringify(snapshot)}};
      }
      queueMicrotask(()=>this.emit('message',{data:JSON.stringify({id:command.id,result})}));
    }
    close(){closed=true;}
  }
  const result=await readCdpPage('wss://connect.browser-use.com/test',url,AbortSignal.timeout(1000),{
    WebSocketImpl:Socket,pollMs:1,interstitialWaitMs:15,now:()=>clock
  });
  assert.equal(closed,true);
  assert.equal(commands.filter(method=>method==='Page.navigate').length,1);
  assert.equal(commands.some(method=>method.startsWith('Input.')||method==='Network.setCookie'),false);
  return {result,reads};
}

const completed=await simulate([checking,checking,listing,listing]);
assert.equal(completed.result.heading,'AUDI RS3');
assert.equal(classify(completed.result),'ok');
assert.equal(completed.reads,4);
const persistent=await simulate([checking]);
assert.equal(classify(persistent.result),'blocked');
assert.equal(persistent.reads,4);
const direct=await simulate([listing,listing]);
assert.equal(direct.reads,2);
assert.equal(browserOptions.solveCaptchas,false);
assert.equal(browserOptions.proxyCountryCode,null);
console.log('PASS: normal page loading can complete; persistent access checks remain blocked; one navigation; no challenge actions; CDP closed.');
