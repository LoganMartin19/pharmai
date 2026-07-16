import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browserLocalPersistence, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, collection, collectionGroup, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db, functionsBaseUrl } from './firebase';
import './styles.css';

const partnerNav = ['Overview', 'Inbox', 'Patients', 'Services', 'Support', 'Settings'];
const adminNav = ['Overview', 'Users', 'Pharmacies', 'Partnerships', 'Support', 'Audit'];
const requestActions = ['accepted', 'ready_later', 'need_more_info', 'out_of_stock', 'completed', 'rejected'];

function formatDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await setPersistence(auth, browserLocalPersistence); await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch { setError('Sign-in failed. Use an authorised PharmAI partner or admin account.'); }
    finally { setBusy(false); }
  };
  return <main className="login-shell"><section className="login-card">
    <div className="brand"><span className="brand-mark">P</span><span>PharmAI</span></div>
    <p className="eyebrow">SECURE WORKSPACE</p><h1>Partner portal</h1>
    <p className="muted">Manage patient requests, pharmacy services and partnership support.</p>
    <form onSubmit={submit}><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" /></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" /></label>
      {error && <p className="error">{error}</p>}<button className="primary" disabled={busy}>{busy?'Signing in…':'Sign in securely'}</button></form>
    <p className="security-note">Authorised users only · Activity is audited · MFA required for live partners</p>
  </section></main>;
}

function Shell({ profile, children, active, setActive }) {
  const nav = profile.isAdmin ? adminNav : partnerNav;
  return <div className="app-shell"><aside><div className="brand inverse"><span className="brand-mark">P</span><span>PharmAI</span></div>
    <div className="workspace"><small>{profile.isAdmin?'INTERNAL OPERATIONS':'PARTNER WORKSPACE'}</small><strong>{profile.orgName || 'PharmAI'}</strong><span>{profile.branchName || (profile.isAdmin?'Platform administration':'All permitted branches')}</span></div>
    <nav>{nav.map(item=><button key={item} className={active===item?'active':''} onClick={()=>setActive(item)}><span>{({Overview:'◫',Inbox:'▤',Patients:'♙',Services:'✚',Support:'?',Settings:'⚙',Users:'♙',Pharmacies:'✚',Partnerships:'◇',Audit:'≡'})[item]}</span>{item}</button>)}</nav>
    <button className="signout" onClick={()=>signOut(auth)}>Sign out</button></aside>
    <main className="content"><header><div><p className="eyebrow">{profile.isAdmin?'PHARMAI ADMIN':'PHARMAI PARTNER'}</p><h1>{active}</h1></div><div className="user-chip"><span>{profile.email?.slice(0,1).toUpperCase()}</span><div><strong>{profile.displayName || profile.email}</strong><small>{profile.role}</small></div></div></header>{children}</main></div>;
}

const Stat = ({label,value,detail,tone}) => <article className={`stat ${tone||''}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
const Badge = ({children}) => <span className={`badge ${String(children).replaceAll('_','-')}`}>{String(children).replaceAll('_',' ')}</span>;
const Empty = ({title,body}) => <div className="empty"><strong>{title}</strong><p>{body}</p></div>;

function PartnerPortal({ profile }) {
  const [active,setActive]=useState('Overview'); const [requests,setRequests]=useState([]); const [shares,setShares]=useState([]); const [support,setSupport]=useState([]);
  useEffect(()=>{
    if(!profile.orgId) return;
    const unsub1=onSnapshot(query(collection(db,'pharmacyRequests'),where('pharmacyOrgId','==',profile.orgId),limit(200)),s=>setRequests(s.docs.map(d=>({id:d.id,...d.data()}))));
    const unsub2=onSnapshot(query(collection(db,'pharmacyPatientShares'),where('pharmacyOrgId','==',profile.orgId),where('active','==',true),where('expiresAt','>',Timestamp.now()),limit(200)),s=>setShares(s.docs.map(d=>({id:d.id,...d.data()}))));
    const unsub3=onSnapshot(query(collection(db,'supportThreads'),where('pharmacyOrgId','==',profile.orgId),limit(100)),s=>setSupport(s.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{unsub1();unsub2();unsub3();};
  },[profile.orgId]);
  const pending=requests.filter(r=>['pending','need_more_info'].includes(r.status));
  const completed=requests.filter(r=>r.status==='completed');
  const secureAction=async body=>{const token=await auth.currentUser.getIdToken();const response=await fetch(`${functionsBaseUrl}/pharmacyPortalAction`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({organisationId:profile.orgId,...body})});if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Secure action failed');}return response.json();};
  const updateRequest=async(r,status)=>secureAction({action:'update_request_status',requestId:r.id,status});
  const recordPickup=async(share)=>secureAction({action:'record_pickup',shareId:share.id});
  return <Shell profile={profile} active={active} setActive={setActive}>
    {active==='Overview'&&<><section className="stats"><Stat label="Needs action" value={pending.length} detail="Across your branches" tone="amber"/><Stat label="Active patient shares" value={shares.length} detail="Consent-controlled"/><Stat label="Completed requests" value={completed.length} detail="Current data" tone="green"/><Stat label="Open support" value={support.filter(x=>x.status!=='closed').length} detail="PharmAI conversations"/></section>
      <section className="grid"><div className="panel wide"><div className="panel-head"><div><h2>Priority inbox</h2><p>Requests needing a pharmacy response</p></div><button className="text-btn" onClick={()=>setActive('Inbox')}>View all</button></div><RequestTable rows={pending.slice(0,6)} onUpdate={updateRequest}/></div>
      <div className="panel"><h2>Patient privacy</h2><p className="muted">Adherence is shown only where a patient has granted an active, scoped consent. Raw dose history is never exposed.</p><div className="privacy-ok">✓ Consent controls active</div></div></section></>}
    {active==='Inbox'&&<div className="panel"><div className="panel-head"><div><h2>Patient and service requests</h2><p>Prescription queries, Pharmacy First, NMS and appointments</p></div></div><RequestTable rows={requests} onUpdate={updateRequest}/></div>}
    {active==='Patients'&&<div className="panel"><div className="panel-head"><div><h2>Consented patient shares</h2><p>Only the minimum information authorised by each patient</p></div></div>{shares.length?<table><thead><tr><th>Patient</th><th>Medicine</th><th>Shared scope</th><th>Adherence summary</th><th>Consent expiry</th><th></th></tr></thead><tbody>{shares.map(s=><tr key={s.id}><td>{s.patientDisplayName||'Patient'}</td><td>{s.medicationName||'—'}</td><td>{(s.scopes||[]).join(', ')}</td><td>{s.adherenceSummary?.percentage!=null?`${s.adherenceSummary.percentage}% · ${s.adherenceSummary.windowDays||30} days`:'Not shared'}</td><td>{formatDate(s.expiresAt)}</td><td><button className="small" onClick={()=>recordPickup(s)}>Record pickup</button></td></tr>)}</tbody></table>:<Empty title="No active patient shares" body="Patients appear here only after explicitly consenting in the PharmAI app."/>}</div>}
    {active==='Services'&&<Services profile={profile}/>} {active==='Support'&&<Support profile={profile} threads={support}/>} {active==='Settings'&&<Settings profile={profile}/>}</Shell>;
}

function RequestTable({rows,onUpdate}) { return rows.length?<div className="table-wrap"><table><thead><tr><th>Patient/request</th><th>Branch</th><th>Received</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.requestType?.replaceAll('_',' ')||'Prescription enquiry'}</strong><small>{r.medication?.name||r.note||'No medicine supplied'}</small></td><td>{r.pharmacy?.name||r.branchName||'—'}</td><td>{formatDate(r.createdAt)}</td><td><Badge>{r.status||'pending'}</Badge></td><td><select value="" onChange={e=>e.target.value&&onUpdate(r,e.target.value)}><option value="">Update…</option>{requestActions.map(a=><option key={a}>{a}</option>)}</select></td></tr>)}</tbody></table></div>:<Empty title="Inbox clear" body="New patient and pharmacy-service requests will appear here."/>; }

function Services({profile}) { const cards=['New Medicine Service','Pharmacy First','Blood pressure checks','Contraception','Vaccinations','Smoking cessation']; return <div className="card-grid">{cards.map((name,i)=><article className="service-card" key={name}><span>{['NMS','PF','BP','CS','VAC','SC'][i]}</span><div><h3>{name}</h3><p>Manage availability, referrals and follow-up opportunities for participating branches.</p></div><button className="small">Configure</button></article>)}</div>; }

function Support({profile,threads}) { const [subject,setSubject]=useState(''); const [message,setMessage]=useState(''); const submit=async e=>{e.preventDefault();if(!subject.trim()||!message.trim())return;await addDoc(collection(db,'supportThreads'),{pharmacyOrgId:profile.orgId||null,createdBy:auth.currentUser.uid,createdByEmail:auth.currentUser.email,subject:subject.trim(),latestMessage:message.trim(),status:'open',priority:'normal',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});setSubject('');setMessage('');}; return <section className="grid"><div className="panel wide"><h2>Support conversations</h2>{threads.length?threads.map(t=><div className="thread" key={t.id}><div><strong>{t.subject}</strong><p>{t.latestMessage}</p></div><Badge>{t.status}</Badge></div>):<Empty title="No support conversations" body="Start a conversation with PharmAI operations."/>}</div><form className="panel form" onSubmit={submit}><h2>Contact PharmAI</h2><label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} required/></label><label>Message<textarea rows="6" value={message} onChange={e=>setMessage(e.target.value)} required/></label><button className="primary">Send securely</button></form></section>; }
function Settings({profile}) { return <section className="grid"><div className="panel"><h2>Organisation access</h2><dl><dt>Organisation</dt><dd>{profile.orgName}</dd><dt>Your role</dt><dd>{profile.role}</dd><dt>Branch scope</dt><dd>{profile.branchName||'All permitted branches'}</dd></dl></div><div className="panel"><h2>Security controls</h2><ul className="checks"><li>Role-based access</li><li>Consent-scoped patient data</li><li>Audited pharmacy actions</li><li>Server-side administration</li></ul><p className="muted">MFA must be enforced in Firebase Identity Platform before live partner access.</p></div></section>; }

function AdminPortal({profile}) { const [active,setActive]=useState('Overview'); const [counts,setCounts]=useState({}); const [orgs,setOrgs]=useState([]); const [threads,setThreads]=useState([]); const [audit,setAudit]=useState([]);
  useEffect(()=>{(async()=>{const token=await auth.currentUser.getIdToken();const response=await fetch(`${functionsBaseUrl}/adminMetrics`,{headers:{Authorization:`Bearer ${token}`}});if(response.ok)setCounts(await response.json());})(); const a=onSnapshot(query(collection(db,'pharmacyOrganisations'),limit(200)),s=>setOrgs(s.docs.map(d=>({id:d.id,...d.data()})))); const b=onSnapshot(query(collection(db,'supportThreads'),orderBy('updatedAt','desc'),limit(100)),s=>setThreads(s.docs.map(d=>({id:d.id,...d.data()})))); const c=onSnapshot(query(collection(db,'auditEvents'),orderBy('createdAt','desc'),limit(100)),s=>setAudit(s.docs.map(d=>({id:d.id,...d.data()})))); return()=>{a();b();c();};},[]);
  return <Shell profile={profile} active={active} setActive={setActive}>{active==='Overview'&&<><section className="stats"><Stat label="Registered users" value={counts.users??'—'} detail="Firebase accounts"/><Stat label="Partner organisations" value={counts.pharmacyOrganisations??orgs.length} detail="Active and onboarding" tone="green"/><Stat label="Patient requests" value={counts.pharmacyRequests??'—'} detail="All time"/><Stat label="Open support" value={counts.openSupport??threads.filter(t=>t.status!=='closed').length} detail="Needs response" tone="amber"/></section><section className="grid"><div className="panel wide"><h2>Partnership health</h2><OrgTable orgs={orgs}/></div><div className="panel"><h2>Governance snapshot</h2><ul className="checks"><li>Consent-gated adherence</li><li>Admin claims required</li><li>Cross-tenant rules enabled</li><li>Audit event collection active</li></ul></div></section></>}
    {active==='Users'&&<div className="panel"><h2>User metrics</h2><p className="muted">Privacy-preserving aggregates only. Individual account access should be reserved for documented support or safety purposes.</p><section className="stats compact"><Stat label="Total" value={counts.users??'—'} detail="Accounts"/><Stat label="Active 30 days" value={counts.activeUsers30d??'—'} detail="Requires analytics event rollout"/></section></div>}
    {active==='Pharmacies'&&<div className="panel"><h2>Pharmacy organisations</h2><OrgTable orgs={orgs}/></div>}{active==='Partnerships'&&<Partnerships orgs={orgs}/>} 
    {active==='Support'&&<div className="panel"><h2>Partner support</h2>{threads.map(t=><div className="thread" key={t.id}><div><strong>{t.subject}</strong><p>{t.latestMessage}</p><small>{t.createdByEmail}</small></div><select value={t.status||'open'} onChange={e=>updateDoc(doc(db,'supportThreads',t.id),{status:e.target.value,updatedAt:serverTimestamp()})}><option>open</option><option>waiting_partner</option><option>resolved</option><option>closed</option></select></div>)}</div>}
    {active==='Audit'&&<div className="panel"><h2>Security audit events</h2>{audit.length?<table><thead><tr><th>Event</th><th>Actor</th><th>Organisation</th><th>Time</th></tr></thead><tbody>{audit.map(a=><tr key={a.id}><td>{a.action}</td><td>{a.actorEmail||a.actorUid}</td><td>{a.pharmacyOrgId||'Platform'}</td><td>{formatDate(a.createdAt)}</td></tr>)}</tbody></table>:<Empty title="No audit events" body="Sensitive server-side actions will be recorded here."/>}</div>}</Shell>; }
const OrgTable=({orgs})=>orgs.length?<table><thead><tr><th>Organisation</th><th>Status</th><th>Branches</th><th>Partner since</th></tr></thead><tbody>{orgs.map(o=><tr key={o.id}><td><strong>{o.name}</strong><small>{o.primaryContactEmail}</small></td><td><Badge>{o.status||'onboarding'}</Badge></td><td>{o.branchCount||0}</td><td>{formatDate(o.createdAt)}</td></tr>)}</tbody></table>:<Empty title="No partner organisations" body="Approved pharmacy partners will appear here."/>;

function Partnerships({orgs}) { const [name,setName]=useState('');const [email,setEmail]=useState('');const [memberEmail,setMemberEmail]=useState('');const [orgId,setOrgId]=useState('');const [notice,setNotice]=useState('');
  const call=async body=>{setNotice('Working…');const token=await auth.currentUser.getIdToken();const response=await fetch(`${functionsBaseUrl}/adminProvisionPortal`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data;};
  const create=async e=>{e.preventDefault();try{await call({action:'create_organisation',name,primaryContactEmail:email});setName('');setEmail('');setNotice('Organisation created in onboarding.');}catch(e){setNotice(e.message)}};
  const add=async e=>{e.preventDefault();try{await call({action:'add_member',organisationId:orgId,email:memberEmail,role:'org_admin'});setMemberEmail('');setNotice('Organisation administrator added.');}catch(e){setNotice(e.message)}};
  return <section className="grid"><div className="panel wide"><h2>Partnership pipeline</h2><OrgTable orgs={orgs}/></div><div><form className="panel form" onSubmit={create}><h2>Create partner</h2><label>Organisation name<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Primary contact<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><button className="primary">Create onboarding record</button></form><form className="panel form top-gap" onSubmit={add}><h2>Add organisation admin</h2><label>Organisation<select value={orgId} onChange={e=>setOrgId(e.target.value)} required><option value="">Select…</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>Existing PharmAI account email<input type="email" value={memberEmail} onChange={e=>setMemberEmail(e.target.value)} required/></label><button className="primary">Grant partner access</button>{notice&&<p className="muted">{notice}</p>}</form></div></section>;
}

function App(){const [user,setUser]=useState(undefined);const [profile,setProfile]=useState(null);const [error,setError]=useState('');useEffect(()=>onAuthStateChanged(auth,async current=>{setUser(current||null);setProfile(null);setError('');if(!current)return;try{const token=await current.getIdTokenResult(true);if(token.claims.admin){setProfile({isAdmin:true,email:current.email,displayName:current.displayName,role:'Platform administrator'});return;}const memberships=await getDocs(query(collectionGroup(db,'members'),where('uid','==',current.uid),where('active','==',true),limit(1)));if(memberships.empty){setError('This account has no active pharmacy or PharmAI admin role.');return;}const member=memberships.docs[0];const orgRef=member.ref.parent.parent;const org=await getDoc(orgRef);setProfile({isAdmin:false,email:current.email,displayName:member.data().displayName||current.displayName,role:member.data().role||'pharmacy_staff',orgId:orgRef.id,orgName:org.data()?.name||'Pharmacy partner',branchId:member.data().branchIds?.[0]||null,branchName:member.data().branchName||null});}catch(e){console.error(e);setError('Unable to verify portal permissions.');}}),[]);if(user===undefined)return <div className="loading">Loading secure workspace…</div>;if(!user)return <Login/>;if(error)return <main className="login-shell"><section className="login-card"><h1>Access not configured</h1><p className="error">{error}</p><button className="primary" onClick={()=>signOut(auth)}>Sign out</button></section></main>;if(!profile)return <div className="loading">Verifying permissions…</div>;return profile.isAdmin?<AdminPortal profile={profile}/>:<PartnerPortal profile={profile}/>;}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
