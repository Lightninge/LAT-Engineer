import {useEffect,useState,useCallback} from 'react'
import {supabase} from './supabase'
const PHASES=['Aanvraag schouw','Voorbereiding en uitvoering schouw','Uitwerking schouw en aangepaste tekening','Aanvraag planning en VO2','Mapoverdracht','Eindcontrole']
const MODULES={boomcheck:'Bomencheck',klic:'KLIC',vgis:'vGIS',boringen:'Boringen',nanodrills:'Nanodrills',boogzinkers:'Boogzinkers',persingen:'Persingen',zandzuigen:'Zandzuigen',proefsleuven:'Proefsleuven',verkeersplannen:'Verkeersplannen',verkeersmeldingen:'Verkeersmeldingen',offertes:'Offertes',onderaannemers:'Onderaannemers',extra_schouw:'Extra schouw',vo1:'VO1',vo2:'VO2 met Liander'}
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
const down=(n,t)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'application/json'}));a.download=n;a.click()}
const applicable=(it,on)=>it.rule.active&&(!it.rule.module||on.has(it.rule.module))
const calc=(items,on,ec)=>{const a=items.filter(i=>applicable(i,on)&&i.status!=='nvt'&&(ec?i.rule.phase===6:i.rule.phase<6));const d=a.filter(i=>i.status==='klaar').length;return{total:a.length,done:d,pct:a.length?Math.round(d/a.length*100):0}}
const Bar=({p})=><div className="bar"><i style={{width:p+'%'}}/></div>
const onSet=m=>new Set(m.filter(x=>x.active).map(x=>x.module))
const load1=async id=>{const[a,b,c]=await Promise.all([supabase.from('projects').select('*').eq('id',id).single(),supabase.from('project_items').select('*,rule:rules(*)').eq('project_id',id).limit(2000),supabase.from('project_modules').select('*').eq('project_id',id)]);return{p:a.data,items:b.data||[],mods:c.data||[]}}
const sync=async id=>{const[{data:m},{data:rules},{data:have}]=await Promise.all([supabase.from('project_modules').select('module').eq('project_id',id).eq('active',true),supabase.from('rules').select('id,module').eq('active',true),supabase.from('project_items').select('rule_id').eq('project_id',id).limit(2000)])
 const on=new Set((m||[]).map(x=>x.module)),h=new Set((have||[]).map(x=>x.rule_id)),miss=(rules||[]).filter(r=>(!r.module||on.has(r.module))&&!h.has(r.id))
 if(miss.length)await supabase.from('project_items').upsert(miss.map(r=>({project_id:id,rule_id:r.id})),{onConflict:'project_id,rule_id',ignoreDuplicates:true})}
const exportJson=async id=>{await sync(id);const{p,items,mods}=await load1(id),on=onSet(mods),s=calc(items,on),e=calc(items,on,true)
 down(`checklist-${(p.name||'project').replace(/[^\w-]+/g,'_')}.json`,JSON.stringify({format:'wvb-checklist',version:1,exported_at:new Date().toISOString(),project:{name:p.name,maker:p.maker,location:p.location,notes:p.notes,status:p.status,created_at:p.created_at},progress:s,eindcontrole:e,modules:mods.map(m=>({module:m.module,active:m.active})),items:items.map(i=>({rule_id:i.rule_id,phase:i.rule.phase,category:i.rule.category,title:i.rule.title,module:i.rule.module,status:i.status,done_by:i.done_by,done_at:i.done_at,comment:i.comment}))},null,2))}
const printPdf=async id=>{const w=window.open('','_blank');await sync(id);const{p,items,mods}=await load1(id),on=onSet(mods),s=calc(items,on),ap=items.filter(i=>applicable(i,on)).sort((a,b)=>a.rule.sort-b.rule.sort)
 let h=`<h1>${esc(p.name)}</h1><p>Locatie: ${esc(p.location)} · Maker: ${esc(p.maker)} · Voortgang: ${s.pct}% (${s.done}/${s.total}) · Status: ${esc(p.status)}</p><p>Actieve onderdelen: ${[...on].map(m=>MODULES[m]).join(', ')||'geen'}</p>`
 PHASES.forEach((n,i)=>{const pi=ap.filter(x=>x.rule.phase===i+1);if(pi.length)h+=`<h2>${i+1}. ${esc(n)}</h2>`+pi.map(x=>`<div>${x.status==='klaar'?'☑':'☐'} ${esc(x.rule.title)}${x.comment?` <i>– ${esc(x.comment)}</i>`:''}</div>`).join('')})
 w.document.write(`<html><head><title>${esc(p.name)}</title><style>body{font:13px sans-serif;margin:24px}h2{background:#eee;padding:4px}</style></head><body>${h}</body></html>`);w.document.close();w.print()}

function Auth(){const[e,setE]=useState(''),[p,setP]=useState(''),[m,setM]=useState('');
 const go=async up=>{const r=up?await supabase.auth.signUp({email:e,password:p}):await supabase.auth.signInWithPassword({email:e,password:p});setM(r.error?.message||(up?'Check je e-mail voor bevestiging.':''))}
 return <main style={{margin:'60px auto',maxWidth:340}}><h2>Werkvoorbereiding</h2><div className="grid" style={{gridTemplateColumns:'1fr'}}><input placeholder="E-mail" value={e} onChange={x=>setE(x.target.value)}/><input type="password" placeholder="Wachtwoord" value={p} onChange={x=>setP(x.target.value)}/><button onClick={()=>go(false)}>Inloggen</button><button onClick={()=>go(true)}>Account aanmaken</button><small className="warn">{m}</small></div></main>}

export default function App(){
 const[session,setSession]=useState(null),[profile,setProfile]=useState(null),[view,setView]=useState({page:'dash'})
 useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));const{data:s}=supabase.auth.onAuthStateChange((_,x)=>setSession(x));return()=>s.subscription.unsubscribe()},[])
 useEffect(()=>{if(session)supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>setProfile(data))},[session])
 if(!session)return <Auth/>
 return <div className="app"><div className="nav"><h2>Werkvoorbereiding</h2><button onClick={()=>setView({page:'dash'})}>Mijn checklists</button><button onClick={()=>supabase.auth.signOut()}>Uitloggen</button><small><br/>{profile?.full_name||session.user.email}</small></div>
 <main>{view.page==='dash'?<Dashboard user={session.user} profile={profile} open={id=>setView({page:'project',id})}/>:<Project id={view.id} user={session.user} back={()=>setView({page:'dash'})}/>}</main></div>}

function Dashboard({user,profile,open}){
 const[projects,setProjects]=useState([]),[items,setItems]=useState([]),[mods,setMods]=useState([]),[q,setQ]=useState(''),[f,setF]=useState({name:'',maker:'',location:''}),[pend,setPend]=useState(null),[target,setTarget]=useState('new'),[msg,setMsg]=useState('')
 const load=useCallback(async()=>{const p=await supabase.from('projects').select('*').order('created_at',{ascending:false});let all=[],from=0;for(;;){const{data}=await supabase.from('project_items').select('project_id,status,rule:rules(*)').range(from,from+999);all=all.concat(data||[]);if(!data||data.length<1000)break;from+=1000}
  const m=await supabase.from('project_modules').select('*').eq('active',true);setProjects(p.data||[]);setItems(all);setMods(m.data||[])},[])
 useEffect(()=>{load()},[load])
 const create=async()=>{if(!f.name)return alert('Vul een naam in');const{data,error}=await supabase.from('projects').insert({name:f.name,maker:f.maker||profile?.full_name,location:f.location,created_by:user.id}).select().single();if(error)return alert(error.message)
  await supabase.from('activity').insert({project_id:data.id,user_id:user.id,action:'Checklist aangemaakt'});open(data.id)}
 const del=async p=>{if(confirm(`Checklist "${p.name}" definitief verwijderen?`)){await supabase.from('projects').delete().eq('id',p.id);load()}}
 const readFile=async file=>{try{const d=JSON.parse(await file.text());if(d.format!=='wvb-checklist'||!d.project?.name||!Array.isArray(d.items))throw 0;setMsg('');setTarget('new');setPend(d)}catch{setMsg('Dit is geen geldig checklistbestand (JSON uit deze website).')}}
 const run=async()=>{const{data:rules}=await supabase.from('rules').select('id,title,module'),byId=new Map(rules.map(r=>[r.id,r])),byT=new Map(rules.map(r=>[r.title+'|'+(r.module||''),r])),pr={name:pend.project.name,maker:pend.project.maker,location:pend.project.location,notes:pend.project.notes,status:pend.project.status||'actief'};let pid=target
  if(target==='new'){const{data,error}=await supabase.from('projects').insert({...pr,created_by:user.id}).select().single();if(error)return alert(error.message);pid=data.id}
  else{if(!confirm('De gegevens en statussen van de gekozen checklist worden overschreven met die uit het bestand. Doorgaan?'))return;await supabase.from('projects').update(pr).eq('id',pid)}
  const mr=(pend.modules||[]).filter(m=>MODULES[m.module]).map(m=>({project_id:pid,module:m.module,active:!!m.active}));if(mr.length)await supabase.from('project_modules').upsert(mr)
  const rows=[];pend.items.forEach(i=>{const r=byId.get(i.rule_id)||byT.get(i.title+'|'+(i.module||''));if(r)rows.push({project_id:pid,rule_id:r.id,status:i.status||'open',done_by:i.done_by||null,done_at:i.done_at||null,comment:i.comment||null,updated_by:user.id,updated_at:new Date().toISOString()})})
  let{error}=await supabase.from('project_items').upsert(rows,{onConflict:'project_id,rule_id'});if(error){rows.forEach(r=>r.done_by=null);({error}=await supabase.from('project_items').upsert(rows,{onConflict:'project_id,rule_id'}))}
  if(error)return alert(error.message);await supabase.from('activity').insert({project_id:pid,user_id:user.id,action:'Checklist geïmporteerd'});setPend(null);open(pid)}
 const stat=p=>calc(items.filter(i=>i.project_id===p.id),onSet(mods.filter(m=>m.project_id===p.id)))
 const shown=projects.filter(p=>(p.name+(p.location||'')).toLowerCase().includes(q.toLowerCase()))
 return <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.dataTransfer.files[0]&&readFile(e.dataTransfer.files[0])}}><h2>Mijn checklists</h2>
 <div className="card"><h3>Nieuwe checklist</h3><div className="grid" style={{gridTemplateColumns:'1fr 1fr 1fr auto'}}><input placeholder="Naam checklist / project" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/><input placeholder={'Naam maker'+(profile?.full_name?` (${profile.full_name})`:'')} value={f.maker} onChange={e=>setF({...f,maker:e.target.value})}/><input placeholder="Locatie" value={f.location} onChange={e=>setF({...f,location:e.target.value})}/><button onClick={create}>Checklist aanmaken</button></div></div>
 <div className="card" style={{borderStyle:'dashed'}}><b>Checklist importeren</b> – sleep een JSON-bestand hierheen of <input type="file" accept=".json,application/json" onChange={e=>e.target.files[0]&&readFile(e.target.files[0])}/><div className="warn">{msg}</div></div>
 {pend&&<div className="card"><b>Importeren: {pend.project.name}</b> <small>({pend.project.location||'geen locatie'} · {pend.progress?.pct??'?'}% · {pend.items.length} regels)</small><p>Wat wil je doen? <select value={target} onChange={e=>setTarget(e.target.value)}><option value="new">Toevoegen als nieuwe checklist</option>{projects.map(p=><option key={p.id} value={p.id}>Bestaande bijwerken: {p.name}</option>)}</select> <button onClick={run}>Importeren</button> <button onClick={()=>setPend(null)}>Annuleren</button></p></div>}
 <input placeholder="Zoek op naam of locatie" value={q} onChange={e=>setQ(e.target.value)} style={{width:'100%'}}/>
 {shown.map(p=>{const s=stat(p);return <div key={p.id} className="card"><b>{p.name}</b> <small>{p.location} · {p.maker} · {new Date(p.created_at).toLocaleDateString('nl-NL')} · {p.status}</small><Bar p={s.pct}/><small>{s.pct}% · {s.done} afgerond · {s.total-s.done} openstaand</small><p><button onClick={()=>open(p.id)}>Openen</button> <button onClick={()=>exportJson(p.id)}>Download</button> <button onClick={()=>printPdf(p.id)}>PDF</button> <button onClick={()=>del(p)}>Verwijderen</button></p></div>})}
 {!shown.length&&<p>Nog geen checklists.</p>}</div>}

const Row=({it,names,tick,upd})=><div className="row"><input type="checkbox" checked={it.status==='klaar'} onChange={e=>tick(it,e.target.checked)}/><span className={it.status==='klaar'?'done':''}>{it.rule.title}{it.rule.module&&<small> ({MODULES[it.rule.module]})</small>}{it.status==='klaar'&&it.done_at&&<small> · {names[it.done_by]||''} {new Date(it.done_at).toLocaleString('nl-NL')}</small>}</span><input placeholder="Opmerking" defaultValue={it.comment||''} onBlur={e=>e.target.value!==(it.comment||'')&&upd(it,e.target.value)}/></div>

function Project({id,user,back}){
 const[p,setP]=useState(null),[items,setItems]=useState([]),[mods,setMods]=useState([]),[log,setLog]=useState([]),[names,setNames]=useState({})
 const load=useCallback(async()=>{const[a,b,c]=await Promise.all([load1(id),supabase.from('activity').select('*').eq('project_id',id).order('created_at',{ascending:false}).limit(30),supabase.from('profiles').select('id,full_name')]);setP(a.p);setItems(a.items);setMods(a.mods);setLog(b.data||[]);setNames(Object.fromEntries((c.data||[]).map(x=>[x.id,x.full_name])))},[id])
 useEffect(()=>{let ch;(async()=>{await sync(id);await load();ch=supabase.channel('p'+id).on('postgres_changes',{event:'*',schema:'public',table:'project_items',filter:'project_id=eq.'+id},load).on('postgres_changes',{event:'*',schema:'public',table:'project_modules',filter:'project_id=eq.'+id},load).subscribe()})();return()=>ch&&supabase.removeChannel(ch)},[id,load])
 if(!p)return 'Laden…'
 const on=onSet(mods),st=Object.fromEntries(mods.map(m=>[m.module,m.active]))
 const logA=(action,detail)=>supabase.from('activity').insert({project_id:id,user_id:user.id,action,detail})
 const tick=async(it,v)=>{const t=new Date().toISOString();setItems(items.map(x=>x.id===it.id?{...x,status:v?'klaar':'open',done_by:v?user.id:null,done_at:v?t:null}:x));await supabase.from('project_items').update({status:v?'klaar':'open',done_by:v?user.id:null,done_at:v?t:null,updated_by:user.id,updated_at:t}).eq('id',it.id);logA(v?'Afgerond':'Heropend',it.rule.title)}
 const upd=async(it,comment)=>{await supabase.from('project_items').update({comment,updated_by:user.id,updated_at:new Date().toISOString()}).eq('id',it.id);logA('Opmerking',it.rule.title+': '+comment)}
 const setMod=async(m,v)=>{if(st[m]===v)return;if(!v&&items.some(i=>i.rule.module===m&&i.status==='klaar')&&!confirm('Er zijn al afgeronde taken voor dit onderdeel. Ze blijven bewaard, maar tellen niet meer mee. Doorgaan?'))return
  await supabase.from('project_modules').upsert({project_id:id,module:m,active:v});await sync(id);await logA(v?'Onderdeel geactiveerd':'Onderdeel uitgeschakeld',MODULES[m]);load()}
 const field=async(k,v)=>{if(v!==(p[k]||'')){await supabase.from('projects').update({[k]:v}).eq('id',id);logA('Projectgegevens gewijzigd',k)}}
 const ap=items.filter(i=>applicable(i,on)).sort((a,b)=>a.rule.sort-b.rule.sort),s=calc(items,on),ec=calc(items,on,true),ecItems=ap.filter(i=>i.rule.phase===6)
 const setStatus=async v=>{await supabase.from('projects').update({status:v}).eq('id',id);logA(v==='afgerond'?'Werkvoorbereiding afgerond':'Heropend');load()}
 return <><button onClick={back}>← Mijn checklists</button> <button onClick={()=>exportJson(id)}>Download checklist</button> <button onClick={()=>printPdf(id)}>PDF</button>
 <div className="grid" style={{margin:'12px 0',gridTemplateColumns:'2fr 1fr 1fr'}}>{[['name','Naam'],['maker','Maker'],['location','Locatie']].map(([k,l])=><input key={k} title={l} placeholder={l} defaultValue={p[k]||''} onBlur={e=>field(k,e.target.value)}/>)}</div>
 <div className="card"><b>Voortgang {s.pct}%</b> · {s.done} afgerond · {s.total-s.done} openstaand · Status: {p.status}<Bar p={s.pct}/></div>
 <div className="card"><b>Aanvullende werkzaamheden</b> <small>(Ja = bijbehorende regels verschijnen)</small>{Object.entries(MODULES).map(([k,l])=><div key={k} className="row"><span>Is {l} noodzakelijk?</span><button style={st[k]===true?{background:'#fde68a'}:{}} onClick={()=>setMod(k,true)}>Ja</button><button style={st[k]===false?{background:'#e5e7eb'}:{}} onClick={()=>setMod(k,false)}>Nee</button></div>)}</div>
 {PHASES.slice(0,5).map((name,i)=>{const pi=ap.filter(x=>x.rule.phase===i+1),ps=calc(pi,on),cats=[...new Set(pi.map(x=>x.rule.category))]
  return <details key={i} className="card" open={i===1}><summary>{i+1}. {name} – {ps.pct}% ({ps.done} afgerond, {ps.total-ps.done} open)</summary><Bar p={ps.pct}/>{cats.map(c=><details key={c} open><summary>{c}</summary>{pi.filter(x=>x.rule.category===c).map(it=><Row key={it.id} it={it} names={names} tick={tick} upd={upd}/>)}</details>)}</details>})}
 <details className="card" open><summary>Eindcontrole – {ec.done}/{ec.total} punten gereed</summary><Bar p={ec.pct}/>{ecItems.map(it=><Row key={it.id} it={it} names={names} tick={tick} upd={upd}/>)}
  <p>{p.status!=='afgerond'?<button disabled={ec.done<ec.total} onClick={()=>setStatus('afgerond')}>Werkvoorbereiding afronden</button>:<button onClick={()=>setStatus('actief')}>Heropenen</button>}{ec.done<ec.total&&<small className="warn"> Alle eindcontrolepunten moeten afgevinkt zijn.</small>}</p></details>
 <div className="card"><b>Activiteit</b>{log.map(l=><div key={l.id}><small>{new Date(l.created_at).toLocaleString('nl-NL')} – {names[l.user_id]||''}: {l.action} {l.detail||''}</small></div>)}</div></>}
