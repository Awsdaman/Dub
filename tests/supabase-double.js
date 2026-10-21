/* Test-only Supabase API double. No test transport ships in index.html or site/. */
(() => {
  const sid = crypto.randomUUID();
  window.supabase = {createClient: () => ({
    channel(name) {
      let handlers=[],timer,last=0,sub,closed=false;
      const ch={
        on(type,filter,fn){handlers.push({type,filter,fn});return ch;},
        subscribe(fn){sub=fn;setTimeout(async()=>{last=await (await fetch('/__test/cursor')).json();fn('SUBSCRIBED');timer=setInterval(async()=>{
          if(closed)return;
          try{const data=await(await fetch('/__test/poll?room='+name+'&since='+last+'&sid='+sid)).json();last=data.cursor;
            for(const e of data.events)for(const h of handlers)if(h.type==='broadcast')h.fn({event:e.event,payload:e.payload});
            ch._presence=data.presence;
            handlers.filter(h=>h.type==='presence').forEach(h=>h.fn());
          }catch{}
        },100);},0);return ch;},
        async track(p){ch._me=p;await fetch('/__test/track',{method:'POST',body:JSON.stringify({room:name,sid,p})});},
        presenceState(){return ch._presence||{};},
        async send(p){await fetch('/__test/send',{method:'POST',body:JSON.stringify({room:name,sid,...p})});return 'ok';},
        async close(){closed=true;clearInterval(timer);await fetch('/__test/leave',{method:'POST',body:JSON.stringify({sid})});sub('CLOSED');}
      };return ch;
    },
    async removeChannel(ch){await ch.close();},
    storage:{from:()=>({
      async upload(path,blob,options){const r=await fetch('/__test/storage/'+path,{method:'POST',body:blob,headers:{'Content-Type':options.contentType}});return {error:r.ok?null:new Error('upload')};},
      getPublicUrl:path=>({data:{publicUrl:location.origin+'/__test/storage/'+path}}),
      async list(room){return await(await fetch('/__test/list?room='+room)).json();},
      async remove(paths){return await(await fetch('/__test/remove',{method:'POST',body:JSON.stringify(paths)})).json();}
    })}
  })};
})();
