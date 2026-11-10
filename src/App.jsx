import {useEffect,useState,useCallback} from 'react'
import {supabase} from './supabase'
const PHASES=['Aanvraag schouw','Voorbereiding en uitvoering schouw','Uitwerking schouw en aangepaste tekening','Aanvraag planning en VO2','Mapoverdracht']
const MODULES={boomcheck:'Boomcheck',boringen:'Boringen',nanodrills:'Nanodrills',boogzinkers:'Boogzinkers',persingen:'Persingen',zandzuigen:'Zandzuigen',proefsleuven:'Proefsleuven',verkeersplannen:'Verkeersplannen',vo2:'VO2 met Liander'}
const STATUS={open:'Openstaand',bezig:'Bezig',klaar:'Afgerond',nvt:'Niet van toepassing'}
const applicable=(it,mods)=>it.rule.active&&(!it.rule.module||mods.has(it.rule.module))
const calc=(items,mods)=>{const a=items.filter(i=>applicable(i,mods)&&i.status!=='nvt');const d=a.filter(i=>i.status==='klaar').length;return{total:a.length,done:d,pct:a.length?Math.round(d/a.length*100):0}}
const Bar=({p})=><div className="bar"><i style={{width:p+'%'}}/></div>

function Auth(){const[e,setE]=useState(''),[p,setP]=useState(''),[m,setM]=useState('');
 const go=async up=>{const r=up?await supabase.auth.signUp({email:e,password:p}):await supabase.auth.signInWithPassword({email:e,password:p});setM(r.error?.message||(up?'Check je e-mail voor bevestiging.':''))}
 return <main style={{margin:'60px auto',maxWidth:340}}><h2>Werkvoorbereiding</h2><div className="grid" style={{gridTemplateColumns:'1fr'}}><input placeholder="E-mail" value={e} onChange={x=>setE(x.target.value)}/><input type="password" placeholder="Wachtwoord" value={p} onChange={x=>setP(x.target.value)}/><button onClick={()=>go(false)}>Inloggen</button><button onClick={()=>go(true)}>Account aanmaken</button><small className="warn">{m}</small></div></main>}

export default function App(){
 const[session,setSession]=useState(null),[profile,setProfile]=useState(null),[view,setView]=useState({page:'dash'})
 useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));const{data:s}=supabase.auth.onAuthStateChange((_,x)=>setSession(x));return()=>s.subscription.unsubscribe()},[])
 useEffect(()=>{if(session)supabase.from('profiles').select('*').eq('id',session.user.id).single().then(({data})=>setProfile(data))},[session])
 if(!session)return <Auth/>
 const canEdit=profile&&profile.role!=='medewerker'
 return <div className="app"><div className="nav"><h2>Werkvoorbereiding</h2><button onClick={()=>setView({page:'dash'})}>Dashboard</button><button onClick={()=>supabase.auth.signOut()}>Uitloggen</button><small>{profile?.full_name||session.user.email}<br/>Rol: {profile?.role}</small></div>
 <main>{view.page==='dash'?<Dashboard canEdit={canEdit} user={session.user} open={id=>setView({page:'project',id})}/>:<Project id={view.id} user={session.user} canEdit={canEdit} back={()=>setView({page:'dash'})}/>}</main></div>}

function Dashboard({canEdit,user,open}){
 const[projects,setProjects]=useState([]),[items,setItems]=useState([]),[mods,setMods]=useState([]),[q,setQ]=useState(''),[f,setF]=useState({number:'',name:'',client:'',location:''}),[sel,setSel]=useState([])
 const load=useCallback(async()=>{const[p,i,m]=await Promise.all([supabase.from('projects').select('*').order('created_at',{ascending:false}),supabase.from('project_items').select('project_id,status,rule:rules(*)'),supabase.from('project_modules').select('*').eq('active',true)]);setProjects(p.data||[]);setItems(i.data||[]);setMods(m.data||[])},[])
 useEffect(()=>{load()},[load])
 const create=async()=>{if(!f.name||!f.number)return alert('Naam en nummer zijn verplicht');
  const{data:p,error}=await supabase.from('projects').insert({...f,created_by:user.id}).select().single();if(error)return alert(error.message)
  const{data:rules}=await supabase.from('rules').select('id,module').eq('active',true)
  await supabase.from('project_items').insert(rules.filter(r=>!r.module||sel.includes(r.module)).map(r=>({project_id:p.id,rule_id:r.id})))
  if(sel.length)await supabase.from('project_modules').insert(sel.map(m=>({project_id:p.id,module:m,active:true})))
  await supabase.from('activity').insert({project_id:p.id,user_id:user.id,action:'Project aangemaakt'});open(p.id)}
 const stat=p=>{const ms=new Set(mods.filter(m=>m.project_id===p.id).map(m=>m.module));return calc(items.filter(i=>i.project_id===p.id),ms)}
 const shown=projects.filter(p=>(p.name+p.number).toLowerCase().includes(q.toLowerCase()))
 return <><h2>Dashboard</h2><div className="card">Projecten: {projects.length} · Actief: {projects.filter(p=>p.status!=='afgerond').length} · Afgerond: {projects.filter(p=>p.status==='afgerond').length}</div>
 <input placeholder="Zoek op naam of projectnummer" value={q} onChange={e=>setQ(e.target.value)} style={{width:'100%'}}/>
 {shown.map(p=>{const s=stat(p);return <div key={p.id} className="card" style={{cursor:'pointer'}} onClick={()=>open(p.id)}><b>{p.number} – {p.name}</b> <small>{p.client} · {p.status}</small><Bar p={s.pct}/><small>{s.pct}% · {s.done} afgerond · {s.total-s.done} openstaand</small></div>})}
 {canEdit&&<div className="card"><h3>Nieuw project</h3><div className="grid">{[['number','Projectnummer'],['name','Projectnaam'],['client','Opdrachtgever'],['location','Locatie']].map(([k,l])=><input key={k} placeholder={l} value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/>)}</div><p>Aanvullende onderdelen (basischecklist wordt altijd geladen):</p><div className="chips">{Object.entries(MODULES).map(([k,l])=><span key={k} className={'chip'+(sel.includes(k)?' on':'')} onClick={()=>setSel(sel.includes(k)?sel.filter(x=>x!==k):[...sel,k])}>{l}</span>)}</div><p><button onClick={create}>Project aanmaken</button></p></div>}</>}

function Project({id,user,canEdit,back}){
 const[p,setP]=useState(null),[items,setItems]=useState([]),[mods,setMods]=useState([]),[log,setLog]=useState([])
 const load=useCallback(async()=>{const[a,b,c,d]=await Promise.all([supabase.from('projects').select('*').eq('id',id).single(),supabase.from('project_items').select('*,rule:rules(*)').eq('project_id',id),supabase.from('project_modules').select('*').eq('project_id',id),supabase.from('activity').select('*').eq('project_id',id).order('created_at',{ascending:false}).limit(30)]);setP(a.data);setItems(b.data||[]);setMods(c.data||[]);setLog(d.data||[])},[id])
 useEffect(()=>{load();const ch=supabase.channel('p'+id).on('postgres_changes',{event:'*',schema:'public',table:'project_items',filter:'project_id=eq.'+id},load).on('postgres_changes',{event:'*',schema:'public',table:'project_modules',filter:'project_id=eq.'+id},load).subscribe();return()=>supabase.removeChannel(ch)},[id,load])
 if(!p)return 'Laden…'
 const active=new Set(mods.filter(m=>m.active).map(m=>m.module))
 const logA=(action,detail)=>supabase.from('activity').insert({project_id:id,user_id:user.id,action,detail})
 const setStatus=async(it,status)=>{const t=new Date().toISOString();await supabase.from('project_items').update({status,updated_by:user.id,updated_at:t,done_by:status==='klaar'?user.id:null,done_at:status==='klaar'?t:null}).eq('id',it.id);logA('Taak '+STATUS[status],it.rule.title)}
 const toggle=async m=>{const on=active.has(m);
  if(on&&items.some(i=>i.rule.module===m&&i.status==='klaar')&&!confirm('Er zijn al afgeronde taken voor dit onderdeel. Ze blijven bewaard maar tellen niet meer mee. Doorgaan?'))return
  await supabase.from('project_modules').upsert({project_id:id,module:m,active:!on})
  if(!on){const{data:rules}=await supabase.from('rules').select('id').eq('module',m).eq('active',true);await supabase.from('project_items').upsert(rules.map(r=>({project_id:id,rule_id:r.id})),{onConflict:'project_id,rule_id',ignoreDuplicates:true})}
  logA(on?'Onderdeel uitgeschakeld':'Onderdeel geactiveerd',MODULES[m])}
 const upd=async(it,comment)=>{await supabase.from('project_items').update({comment,updated_by:user.id,updated_at:new Date().toISOString()}).eq('id',it.id)}
 const ap=items.filter(i=>applicable(i,active)).sort((a,b)=>a.rule.sort-b.rule.sort),s=calc(items,active)
 const req=ap.filter(i=>i.rule.required&&i.status!=='nvt'),reqOpen=req.filter(i=>i.status!=='klaar')
 const finish=async()=>{await supabase.from('projects').update({status:'afgerond'}).eq('id',id);logA('Werkvoorbereiding afgerond');load()}
 return <><button onClick={back}>← Terug</button><h2>{p.number} – {p.name}</h2><small>{p.client} · {p.location} · Status: {p.status}</small>
 <div className="card"><b>Totale voortgang {s.pct}%</b> ({s.done}/{s.total})<Bar p={s.pct}/></div>
 <div className="card"><b>Aanvullende onderdelen</b><div className="chips">{Object.entries(MODULES).map(([k,l])=><span key={k} className={'chip'+(active.has(k)?' on':'')} onClick={()=>canEdit&&toggle(k)}>{l}</span>)}</div></div>
 {PHASES.map((name,i)=>{const pi=ap.filter(x=>x.rule.phase===i+1),ps=calc(pi,active),cats=[...new Set(pi.map(x=>x.rule.category))]
  return <details key={i} className="card" open={i===1}><summary>{i+1}. {name} – {ps.pct}% ({ps.done}/{ps.total})</summary><Bar p={ps.pct}/>
  {cats.map(c=><details key={c} open><summary>{c}</summary>{pi.filter(x=>x.rule.category===c).map(it=><div key={it.id} className="row"><span className={it.status==='klaar'?'done':''}>{it.rule.title}{it.rule.module&&<small> ({MODULES[it.rule.module]})</small>}{it.done_at&&<small> · afgerond {new Date(it.done_at).toLocaleString('nl-NL')}</small>}</span>
   <input placeholder="Opmerking" defaultValue={it.comment||''} onBlur={e=>e.target.value!==(it.comment||'')&&upd(it,e.target.value)}/>
   <select value={it.status} onChange={e=>setStatus(it,e.target.value)}>{Object.entries(STATUS).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>)}</details>)}</details>})}
 <div className="card"><b>Eindcontrole</b> – {req.length-reqOpen.length}/{req.length} verplichte punten gereed
  {reqOpen.map(i=><div key={i.id} className="warn">○ {i.rule.title}</div>)}
  {canEdit&&p.status!=='afgerond'&&<p><button disabled={reqOpen.length>0} onClick={finish}>Werkvoorbereiding afronden</button></p>}</div>
 <div className="card"><b>Activiteit</b>{log.map(l=><div key={l.id}><small>{new Date(l.created_at).toLocaleString('nl-NL')} – {l.action} {l.detail||''}</small></div>)}</div></>}
