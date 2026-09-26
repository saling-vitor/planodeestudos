#!/usr/bin/env python3
import json, os, sys, time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

base=(sys.argv[1] if len(sys.argv)>1 else os.getenv("PWA_URL") or "http://127.0.0.1:8765/").rstrip("/")+"/"
opts=Options()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--window-size=1280,900")
driver=webdriver.Chrome(options=opts)

def wait_ready():
    end=time.time()+12
    while time.time()<end:
        try:
            if driver.execute_script("return document.readyState")== "complete" and driver.execute_script("return !!window.PLANO_ARQ_DATA && !!window.PLANO_ARQ_SYNC"):
                return
        except Exception:
            pass
        time.sleep(.1)
    raise RuntimeError("Plano ARQ não inicializou")

def run(js):
    return driver.execute_script(js)

def run_async(js):
    driver.set_script_timeout(20)
    return driver.execute_async_script(js)

errors=[]
report={}
try:
    driver.get(base+"configuracoes.html")
    wait_ready()

    # Estado limpo do namespace usado pela auditoria.
    run("""
      for(const k of Object.keys(localStorage)){
        if(k.includes('audit-data-safety')||k.startsWith('planoarq:recovery::')||k==='planoarq:last-recovery:v1')localStorage.removeItem(k);
      }
    """)

    # 1. Importação cria recovery e rollback restaura valor anterior.
    report["importRollback"]=run("""
      const D=window.PLANO_ARQ_DATA,k='mindmap_state::audit-data-safety-import';
      localStorage.setItem(k,JSON.stringify({source:'before-import',value:1}));
      D.importEntries([[k,JSON.stringify({source:'imported',value:2})]],{reason:'audit-import',source:'ci'});
      const recovery=D.lastRecoveryPoint(),after=JSON.parse(localStorage.getItem(k)||'null');
      const restored=D.restoreRecoveryPoint(recovery.id),rolled=JSON.parse(localStorage.getItem(k)||'null');
      return {ok:after?.value===2&&recovery?.reason==='audit-import'&&rolled?.value===1&&restored.entries===1,recoveryId:recovery?.id||'',after,rolled};
    """)
    if not report["importRollback"].get("ok"):
        errors.append("import/rollback não preservou o estado anterior")

    # 2. Primeira sincronização: sem confirmação, nada remoto pode ser aplicado.
    report["firstSync"]=run_async("""
      const done=arguments[arguments.length-1],D=window.PLANO_ARQ_DATA,S=window.PLANO_ARQ_SYNC,k='mindmap_state::audit-data-safety-first',uid='00000000-0000-4000-8000-000000000099';
      localStorage.setItem(k,JSON.stringify({source:'local-before-first',value:10}));
      localStorage.removeItem('planoarq:sync-meta:v2::'+uid);
      S.saveConfig({url:'https://audit-data-safety.supabase.co',key:'sb_publishable_audit_data_safety_1234567890'});
      localStorage.setItem('planoarq:supabase-session:v1',JSON.stringify({access_token:'audit-token',refresh_token:'audit-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'audit@example.com'},projectUrl:S.config().url}));
      const oldFetch=window.fetch;
      let remoteValue=JSON.stringify({source:'cloud-first',value:20}),remoteTime='2099-01-01T00:00:00.000Z';
      window.fetch=async(url,opts={})=>{
        const u=String(url),method=String(opts.method||'GET').toUpperCase();
        if(u.includes('/rest/v1/plano_arq_sync_records')&&method==='GET'){
          return new Response(JSON.stringify([{contest_id:'global',namespace:'mindmap_state',record_key:k,payload:{value:remoteValue},updated_at:remoteTime,device_id:'remote-device',deleted:false}]),{status:200,headers:{'Content-Type':'application/json'}});
        }
        if(u.includes('/rest/v1/rpc/plano_arq_upsert_sync_records')&&method==='POST'){
          return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
        }
        return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});
      };
      (async()=>{try{
        const recoveryBeforeGuard=D.lastRecoveryPoint()?.id||'';
        const guarded=await S.syncNow({reason:'ci-first'});
        const unchanged=JSON.parse(localStorage.getItem(k)||'null'),recoveryAfterGuard=D.lastRecoveryPoint()?.id||'';
        const confirmed=await S.syncNow({reason:'ci-first',firstSyncConfirmed:true});
        const applied=JSON.parse(localStorage.getItem(k)||'null'),rp=D.lastRecoveryPoint();
        const rolled=D.restoreRecoveryPoint(rp.id),rollbackValue=JSON.parse(localStorage.getItem(k)||'null');
        done({ok:guarded?.reason==='first-sync-confirmation-required'&&unchanged?.value===10&&recoveryAfterGuard===recoveryBeforeGuard&&confirmed?.ok===true&&applied?.value===20&&rp?.reason==='first-sync'&&rollbackValue?.value===10&&rolled.entries===1,guarded,confirmed:{ok:confirmed?.ok,recoveryIds:confirmed?.recoveryIds},recoveryReason:rp?.reason||'',recoveryBeforeGuard,recoveryAfterGuard,unchanged,applied,rollbackValue});
      }catch(e){done({ok:false,error:String(e)})}finally{window.fetch=oldFetch}})();
    """)
    if not report["firstSync"].get("ok"):
        errors.append("primeira sincronização não respeitou confirmação + recovery")

    # 3. Conflito posterior cria recovery antes de resolver last-write-wins.
    report["conflict"]=run_async("""
      const done=arguments[arguments.length-1],D=window.PLANO_ARQ_DATA,S=window.PLANO_ARQ_SYNC,k='mindmap_state::audit-data-safety-conflict',uid='00000000-0000-4000-8000-000000000098';
      S.saveConfig({url:'https://audit-data-safety.supabase.co',key:'sb_publishable_audit_data_safety_1234567890'});
      localStorage.setItem('planoarq:supabase-session:v1',JSON.stringify({access_token:'audit-token',refresh_token:'audit-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'audit@example.com'},projectUrl:S.config().url}));
      localStorage.setItem(k,JSON.stringify({source:'baseline',value:1}));
      const initialHash=(()=>{let h=2166136261,s=localStorage.getItem(k)||'';for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)})();
      localStorage.setItem('planoarq:sync-meta:v2::'+uid,JSON.stringify({version:2,userId:uid,firstSyncCompleted:true,lastSyncAt:'2026-01-01T00:00:00.000Z',records:{[k]:{hash:initialHash,updatedAt:'2026-01-01T00:00:00.000Z',deviceId:'local-device',deleted:false,dirty:false,remoteUpdatedAt:'2026-01-01T00:00:00.000Z',remoteDeviceId:'remote-device'}}}));
      localStorage.setItem(k,JSON.stringify({source:'local-conflict',value:30}));
      const oldFetch=window.fetch,remoteValue=JSON.stringify({source:'remote-conflict',value:40});
      window.fetch=async(url,opts={})=>{
        const u=String(url),method=String(opts.method||'GET').toUpperCase();
        if(u.includes('/rest/v1/plano_arq_sync_records')&&method==='GET'){
          return new Response(JSON.stringify([{contest_id:'global',namespace:'mindmap_state',record_key:k,payload:{value:remoteValue},updated_at:'2099-02-01T00:00:00.000Z',device_id:'remote-device',deleted:false}]),{status:200,headers:{'Content-Type':'application/json'}});
        }
        if(u.includes('/rest/v1/rpc/plano_arq_upsert_sync_records')&&method==='POST')return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
        return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});
      };
      (async()=>{try{
        const result=await S.syncNow({reason:'ci-conflict'}),after=JSON.parse(localStorage.getItem(k)||'null'),rp=D.lastRecoveryPoint();
        D.restoreRecoveryPoint(rp.id);const rollbackValue=JSON.parse(localStorage.getItem(k)||'null');
        done({ok:result?.ok===true&&result?.conflicts===1&&after?.value===40&&rp?.reason==='sync-conflict'&&rollbackValue?.value===30,result:{conflicts:result?.conflicts,recoveryIds:result?.recoveryIds},recoveryReason:rp?.reason||'',after,rollbackValue});
      }catch(e){done({ok:false,error:String(e)})}finally{window.fetch=oldFetch}})();
    """)
    if not report["conflict"].get("ok"):
        errors.append("conflito multi-dispositivo não gerou recovery recuperável")

    # Recovery é local/privado: não entra em backup nem no conjunto sincronizável.
    report["privacy"]=run("""
      const D=window.PLANO_ARQ_DATA,S=window.PLANO_ARQ_SYNC,keys=D.keys(),backup=D.buildBackup('all'),recoveryKeys=Object.keys(localStorage).filter(k=>k.startsWith(D.RECOVERY_PREFIX));
      return {ok:recoveryKeys.length>0&&recoveryKeys.every(k=>!keys.includes(k)&&!Object.prototype.hasOwnProperty.call(backup.data,k)&&S.syncable(k)===false),recoveryCount:recoveryKeys.length};
    """)
    if not report["privacy"].get("ok"):
        errors.append("pontos de recuperação vazaram para backup/sync")

    # 5. Observabilidade: erro persiste com contexto, pendência é exposta e limpeza funciona.
    report["observability"]=run_async("""
      const done=arguments[arguments.length-1],S=window.PLANO_ARQ_SYNC,k='mindmap_state::audit-data-safety-observability',uid='00000000-0000-4000-8000-000000000097';
      S.saveConfig({url:'https://audit-data-safety.supabase.co',key:'sb_publishable_audit_data_safety_1234567890'});
      localStorage.setItem('planoarq:supabase-session:v1',JSON.stringify({access_token:'audit-token',refresh_token:'audit-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'audit@example.com'},projectUrl:S.config().url}));
      localStorage.removeItem('planoarq:sync-meta:v2::'+uid);localStorage.removeItem('planoarq:last-sync-error:v1');
      localStorage.setItem(k,JSON.stringify({source:'pending',value:50}));
      const oldFetch=window.fetch;
      window.fetch=async()=>{throw new Error('audit-sync-network-failure')};
      (async()=>{try{
        let threw=false;try{await S.syncNow({reason:'ci-observability'})}catch(_){threw=true}
        const failed=S.status(),persisted=JSON.parse(localStorage.getItem('planoarq:last-sync-error:v1')||'null');
        S.clearSyncError();
        const cleared=S.status();
        done({ok:threw&&!!persisted?.message&&failed.sync.pendingRecords>=1&&failed.sync.lastError?.reason==='ci-observability'&&!cleared.sync.lastError,failed:{pending:failed.sync.pendingRecords,lastError:failed.sync.lastError},persisted,cleared:cleared.sync.lastError});
      }catch(e){done({ok:false,error:String(e)})}finally{window.fetch=oldFetch}})();
    """)
    if not report["observability"].get("ok"):
        errors.append("diagnóstico de sincronização não persistiu erro/pendência corretamente")

finally:
    driver.quit()

print(json.dumps({"ok":not errors,"errors":errors,"report":report},ensure_ascii=False,indent=2))
if errors:
    raise SystemExit(1)
