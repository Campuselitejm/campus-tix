import React, { useState, useEffect, createContext, useContext, useCallback } from "react";
import { eventsDB, coordinatorsDB, coordEventsDB, repsDB, inventoryDB, salesDB, cePointsDB, coordCommissionsDB, returnInventoryDB, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase.js";

// ─── ERROR BOUNDARY ──────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(p){super(p);this.state={error:null};}
  componentDidCatch(e){this.setState({error:e.message});}
  render(){if(this.state.error)return React.createElement('div',{style:{padding:24,fontFamily:'monospace',background:'#fff0f0',color:'#c00',fontSize:14,borderRadius:8,margin:16}},React.createElement('b',null,'❌ Error: '),this.state.error);return this.props.children;}
}

// ─── CONSTANTS ───────────────────────────────────────────────
const NAVY='#1B3A6B'; const GOLD='#F5C842'; const PURPLE='#6B3FA0';
const PAYMENT_METHODS=["Cash","Card","Bank Transfer","Other"];
const UNIVERSITIES=["UWI Mona","UTech Jamaica","Northern Caribbean University","University of the Commonwealth Caribbean","Excelsior Community College","Knox College","Shortwood Teachers College","Moneague College","Caribbean Maritime University","Edna Manley College","HEART/NSTA Trust","Bethlehem Moravian College","G.C. Foster College","College of Agriculture Science and Education","Other"];

// ─── UTILS ───────────────────────────────────────────────────
const fmt = {
  currency: n=>`$${Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,
  number: n=>Number(n||0).toLocaleString("en-US"),
  date: d=>{if(!d)return"—";return new Date(d).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"});},
  dateTime: d=>{if(!d)return"—";return new Date(d).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});},
};
const waLink = phone => {
  if(!phone)return null;
  const clean=phone.replace(/\D/g,'');
  const num=clean.startsWith('1')?clean:`1${clean}`;
  return `https://wa.me/${num}`;
};
const WhatsAppBtn = ({phone,label}) => {
  const link=waLink(phone);
  if(!link||!phone)return <span className="text-gray-400 text-sm">{phone||"—"}</span>;
  return <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-green-600 font-semibold text-sm hover:underline"><span>📱</span>{label||phone}</a>;
};
function downloadCSV(fn,h,r){const e=v=>{const s=String(v??"");return s.includes(",")||s.includes('"')?`"${s.replace(/"/g,'""')}"`:`${s}`;};const c=[h,...r].map(row=>row.map(e).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([c],{type:"text/csv"}));a.download=fn;a.click();}

// ─── AUTH ────────────────────────────────────────────────────
const AuthCtx=createContext(null);
const SK="ct_session_v1";
function AuthProvider({children}){
  const[user,setUser]=useState(null);const[loading,setLoading]=useState(true);
  useEffect(()=>{try{const s=sessionStorage.getItem(SK);if(s)setUser(JSON.parse(s));}catch{}setLoading(false);},[]);
  const loginAdmin=(u,p)=>{if(u==="admin"&&p==="admin123"){const s={type:"admin",name:"Admin",id:"admin"};sessionStorage.setItem(SK,JSON.stringify(s));setUser(s);return{success:true};}return{success:false,message:"Invalid credentials."};};
  const loginCoord=async(cid,pw)=>{try{const c=await coordinatorsDB.getByCoordinatorId(cid.toUpperCase());if(!c)return{success:false,message:"Coordinator ID not found."};if(c.status==="Inactive")return{success:false,message:"Account inactive."};if(c.password!==pw)return{success:false,message:"Incorrect password."};const s={type:"coordinator",name:c.name,id:c.id,coordinatorId:c.coordinatorId,mustChangePassword:c.mustChangePassword};sessionStorage.setItem(SK,JSON.stringify(s));setUser(s);return{success:true};}catch(e){return{success:false,message:"Error: "+e.message};}};
  const loginRep=async(rid,pw)=>{try{const r=await repsDB.getByRepId(rid.toUpperCase());if(!r)return{success:false,message:"Rep ID not found."};if(r.status==="Inactive")return{success:false,message:"Account inactive."};if(r.password!==pw)return{success:false,message:"Incorrect password."};const s={type:"rep",name:r.name,id:r.id,repId:r.repId,ceId:r.ceId,mustChangePassword:r.mustChangePassword};sessionStorage.setItem(SK,JSON.stringify(s));setUser(s);return{success:true};}catch(e){return{success:false,message:"Error: "+e.message};}};
  const logout=()=>{sessionStorage.removeItem(SK);setUser(null);};
  const updateSession=u=>{const s={...user,...u};sessionStorage.setItem(SK,JSON.stringify(s));setUser(s);};
  return <AuthCtx.Provider value={{user,loading,loginAdmin,loginCoord,loginRep,logout,updateSession}}>{children}</AuthCtx.Provider>;
}
const useAuth=()=>useContext(AuthCtx);
function useAsync(fn,deps=[]){const[data,setData]=useState(undefined);const[loading,setLoading]=useState(true);const[error,setError]=useState(null);const load=useCallback(async()=>{setLoading(true);setError(null);try{const r=await fn();setData(Array.isArray(r)?r:(r??undefined));}catch(e){setError(e.message);setData(undefined);}setLoading(false);},deps);useEffect(()=>{load();},[load]);return{data,loading,error,reload:load};}
function useToast(){const[t,sT]=useState({visible:false,message:""});const show=m=>{sT({visible:true,message:m});setTimeout(()=>sT({visible:false,message:""}),3000);};return{toast:t,show};}

// ─── SHARED UI ───────────────────────────────────────────────
function Spinner({size="md"}){return <div className={`${size==="sm"?"w-4 h-4 border-2":"w-8 h-8 border-4"} border-gray-200 rounded-full animate-spin`} style={{borderTopColor:NAVY}}/>;}
function Toast({message,visible}){if(!visible)return null;return <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-semibold" style={{background:NAVY}}>✓ {message}</div>;}
function Badge({label,type="default"}){const S={success:"bg-emerald-50 text-emerald-700 border-emerald-200",danger:"bg-red-50 text-red-700 border-red-200",warning:"bg-amber-50 text-amber-700 border-amber-200",info:"bg-blue-50 text-blue-700 border-blue-200",default:"bg-gray-100 text-gray-600 border-gray-200",gold:"bg-yellow-50 text-yellow-700 border-yellow-200",purple:"bg-purple-50 text-purple-700 border-purple-200"};return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold border ${S[type]||S.default}`}>{label}</span>;}
function CEBadge({status}){if(status==="Paid")return <Badge label="✅ Paid" type="success"/>;if(status==="Due")return <Badge label="🔴 Due" type="danger"/>;return <Badge label="⏳ Pending" type="warning"/>;}
function EventStatusBadge({status}){if(status==="Active")return <Badge label="🟢 Active" type="success"/>;if(status==="Closed")return <Badge label="🔒 Closed" type="danger"/>;return <Badge label="📝 Draft" type="default"/>;}
const iCls="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 bg-white";
const iStyle={outline:'none'};
function FF({label,required,error,children,hint}){return(<div>{label&&<label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}{required&&<span className="text-red-500 ml-1">*</span>}</label>}{children}{hint&&<p className="text-xs text-gray-400 mt-1">{hint}</p>}{error&&<p className="text-xs text-red-500 mt-1">{error}</p>}</div>);}
function EmptyState({icon="🎟️",title,message}){return <div className="text-center py-12 px-4"><div className="text-4xl mb-3">{icon}</div><h3 className="text-base font-semibold text-gray-800 mb-1">{title}</h3><p className="text-gray-400 text-sm">{message}</p></div>;}
function PBtn({children,onClick,disabled,loading,className="",variant="navy"}){const V={navy:`text-white`,gold:`text-gray-900`,outline:"border-2 border-gray-200 text-gray-700 bg-white",danger:"bg-red-600 hover:bg-red-700 text-white",green:"bg-emerald-500 hover:bg-emerald-600 text-white"};const BG=variant==="navy"?NAVY:variant==="gold"?GOLD:variant==="outline"?"transparent":variant==="danger"?"#dc2626":"#10b981";return <button onClick={onClick} disabled={disabled||loading} className={`px-5 py-3 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${V[variant]||V.navy} ${className}`} style={variant==="navy"?{background:NAVY}:variant==="gold"?{background:GOLD}:{}}>{loading?<Spinner size="sm"/>:children}</button>;}
function SHeader({title,subtitle,action}){return <div className="flex items-start justify-between mb-5 gap-3"><div><h2 className="text-xl font-bold text-gray-900">{title}</h2>{subtitle&&<p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}</div>{action&&<div className="flex-shrink-0">{action}</div>}</div>;}
function SearchBar({value,onChange,placeholder="Search..."}){return <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span><input type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 bg-white" style={{['--tw-ring-color']:NAVY}}/></div>;}
function Table({headers,rows,empty="No data",loading}){if(loading)return <div className="space-y-3 py-4">{[1,2,3].map(i=><div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse"/>)}</div>;if(!rows.length)return <div className="text-center py-10 text-gray-400 text-sm">{empty}</div>;return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-100">{headers.map((h,i)=><th key={i} className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">{row.map((c,j)=><td key={j} className="py-3 px-3 text-gray-800 whitespace-nowrap">{c}</td>)}</tr>)}</tbody></table></div>;}
function Modal({isOpen,onClose,title,children,size="md"}){if(!isOpen)return null;const S={sm:"max-w-sm",md:"max-w-md",lg:"max-w-lg",xl:"max-w-2xl"};return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}><div className="absolute inset-0 bg-black/50 backdrop-blur-sm"/><div className={`relative bg-white rounded-2xl shadow-2xl w-full ${S[size]} max-h-[90vh] overflow-y-auto`} onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between p-5 border-b border-gray-100"><h2 className="text-lg font-bold text-gray-900">{title}</h2><button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm">✕</button></div><div className="p-5">{children}</div></div></div>;}
function ConfirmModal({isOpen,onClose,onConfirm,title,message,confirmLabel="Confirm",danger}){return <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm"><p className="text-gray-600 mb-6 text-sm">{message}</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 text-sm">Cancel</button><button onClick={()=>{onConfirm();onClose();}} className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-white text-sm ${danger?"bg-red-500 hover:bg-red-600":"bg-gray-900 hover:bg-gray-800"}`}>{confirmLabel}</button></div></Modal>;}
function StatCard({title,value,subtitle,icon,color,onClick,loading}){return <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 ${onClick?"cursor-pointer hover:shadow-md transition-shadow":""}`} onClick={onClick}><div className="flex items-start justify-between"><div className="flex-1 min-w-0"><p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 truncate">{title}</p>{loading?<div className="h-6 w-20 bg-gray-100 rounded animate-pulse mt-1"/>:<p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>}{subtitle&&<p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}</div>{icon&&<div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-base flex-shrink-0 ml-2" style={{background:color||NAVY}}>{icon}</div>}</div></div>;}

// ─── CHANGE PASSWORD (forced first login) ─────────────────────
function ChangePasswordScreen({dbId,userType,onDone}){
  const[form,setForm]=useState({newPw:"",confirmPw:""});
  const[error,setError]=useState("");const[loading,setLoading]=useState(false);
  const{updateSession}=useAuth();
  const submit=async e=>{
    e.preventDefault();setError("");
    if(form.newPw.length<6){setError("Password must be at least 6 characters");return;}
    if(form.newPw!==form.confirmPw){setError("Passwords do not match");return;}
    setLoading(true);
    try{
      if(userType==="coordinator")await coordinatorsDB.changePassword(dbId,form.newPw);
      else await repsDB.changePassword(dbId,form.newPw);
      updateSession({mustChangePassword:false});onDone();
    }catch(e){setError(e.message);}
    setLoading(false);
  };
  return(
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:`linear-gradient(135deg, ${NAVY} 0%, #0f2548 100%)`}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8"><div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-2xl mb-4 text-3xl" style={{background:GOLD}}>🔑</div><h1 className="text-2xl font-bold text-white">Set Your Password</h1><p className="text-blue-200 text-sm mt-1">Create your own password to continue</p></div>
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-3xl p-6">
          {error&&<div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 mb-4 text-red-200 text-sm">⚠️ {error}</div>}
          <form onSubmit={submit} className="space-y-4">
            <div><label className="block text-sm font-medium text-blue-100 mb-1.5">New Password</label><input type="password" value={form.newPw} onChange={e=>setForm(f=>({...f,newPw:e.target.value}))} placeholder="At least 6 characters" className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 text-sm focus:outline-none" required/></div>
            <div><label className="block text-sm font-medium text-blue-100 mb-1.5">Confirm Password</label><input type="password" value={form.confirmPw} onChange={e=>setForm(f=>({...f,confirmPw:e.target.value}))} placeholder="Repeat password" className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 text-sm focus:outline-none" required/></div>
            <button type="submit" disabled={loading} className="w-full py-3.5 font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 text-gray-900" style={{background:GOLD}}>{loading?<Spinner size="sm"/>:"🔑 Set Password & Continue"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN ───────────────────────────────────────────────────
function LoginScreen(){
  const[tab,setTab]=useState("admin");
  const[aF,setAF]=useState({username:"",password:""});
  const[cF,setCF]=useState({coordinatorId:"",password:""});
  const[rF,setRF]=useState({repId:"",password:""});
  const[error,setError]=useState("");const[loading,setLoading]=useState(false);
  const{loginAdmin,loginCoord,loginRep}=useAuth();
  const doAdmin=async e=>{e.preventDefault();setError("");setLoading(true);const res=loginAdmin(aF.username,aF.password);if(!res.success)setError(res.message);setLoading(false);};
  const doCoord=async e=>{e.preventDefault();setError("");setLoading(true);const res=await loginCoord(cF.coordinatorId,cF.password);if(!res.success)setError(res.message);setLoading(false);};
  const doRep=async e=>{e.preventDefault();setError("");setLoading(true);const res=await loginRep(rF.repId,rF.password);if(!res.success)setError(res.message);setLoading(false);};
  const tabs=["admin","coordinator","rep"];
  const tabLabels={admin:"Admin",coordinator:"Coordinator",rep:"Sales Rep"};
  return(
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:`linear-gradient(135deg, ${NAVY} 0%, #0f2548 100%)`}}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none"><div className="absolute top-1/4 -left-24 w-96 h-96 rounded-full blur-3xl opacity-20" style={{background:PURPLE}}/><div className="absolute bottom-1/4 -right-24 w-96 h-96 rounded-full blur-3xl opacity-10" style={{background:GOLD}}/></div>
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl shadow-2xl mb-4 text-4xl" style={{background:GOLD}}>🎟️</div>
          <h1 className="text-3xl font-black text-white">Campus Tix</h1>
          <p className="text-blue-200 text-sm mt-1">Events for Uni in Jamaica</p>
        </div>
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-3xl p-6 shadow-2xl">
          <div className="flex bg-white/10 rounded-2xl p-1 mb-6">
            {tabs.map(t=><button key={t} onClick={()=>{setTab(t);setError("");}} className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${tab===t?"bg-white text-gray-900 shadow-sm":"text-blue-200 hover:text-white"}`}>{tabLabels[t]}</button>)}
          </div>
          {error&&<div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 mb-4 text-red-200 text-sm">⚠️ {error}</div>}
          {tab==="admin"&&(
            <form onSubmit={doAdmin} className="space-y-4">
              <div><label className="block text-sm font-medium text-blue-100 mb-1.5">Username</label><input value={aF.username} onChange={e=>setAF({...aF,username:e.target.value})} placeholder="admin" className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 text-sm focus:outline-none" required/></div>
              <div><label className="block text-sm font-medium text-blue-100 mb-1.5">Password</label><input type="password" value={aF.password} onChange={e=>setAF({...aF,password:e.target.value})} placeholder="••••••••" className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 text-sm focus:outline-none" required/></div>
              <button type="submit" disabled={loading} className="w-full py-3.5 font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 text-gray-900" style={{background:GOLD}}>{loading?<Spinner size="sm"/>:"🔐 Sign In as Admin"}</button>
            </form>
          )}
          {tab==="coordinator"&&(
            <form onSubmit={doCoord} className="space-y-4">
              <div><label className="block text-sm font-medium text-blue-100 mb-1.5">Coordinator ID</label><input value={cF.coordinatorId} onChange={e=>setCF({...cF,coordinatorId:e.target.value})} placeholder="e.g. COORD001" className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 text-sm focus:outline-none uppercase" required/></div>
              <div><label className="block text-sm font-medium text-blue-100 mb-1.5">Password</label><input type="password" value={cF.password} onChange={e=>setCF({...cF,password:e.target.value})} placeholder="••••••••" className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 text-sm focus:outline-none" required/></div>
              <button type="submit" disabled={loading} className="w-full py-3.5 font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 text-gray-900" style={{background:GOLD}}>{loading?<Spinner size="sm"/>:"🎯 Sign In as Coordinator"}</button>
            </form>
          )}
          {tab==="rep"&&(
            <form onSubmit={doRep} className="space-y-4">
              <div><label className="block text-sm font-medium text-blue-100 mb-1.5">Rep ID</label><input value={rF.repId} onChange={e=>setRF({...rF,repId:e.target.value})} placeholder="e.g. REP001" className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 text-sm focus:outline-none uppercase" required/></div>
              <div><label className="block text-sm font-medium text-blue-100 mb-1.5">Password</label><input type="password" value={rF.password} onChange={e=>setRF({...rF,password:e.target.value})} placeholder="••••••••" className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 text-sm focus:outline-none" required/></div>
              <button type="submit" disabled={loading} className="w-full py-3.5 font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 text-gray-900" style={{background:GOLD}}>{loading?<Spinner size="sm"/>:"🚀 Sign In"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN LAYOUT ─────────────────────────────────────────────
const ADMIN_NAV=[
  {id:"dashboard",label:"Dashboard",icon:"📊"},
  {id:"events",label:"Events",icon:"🎉"},
  {id:"coordinators",label:"Coordinators",icon:"🎯"},
  {id:"reps",label:"Sales Reps",icon:"👥"},
  {id:"repinventory",label:"Rep Inventory",icon:"🎟️"},
  {id:"sales",label:"Sales",icon:"💰"},
  {id:"cepoints",label:"CE Points",icon:"⭐"},
  {id:"commissions",label:"Commissions",icon:"💵"},
  {id:"reports",label:"Reports",icon:"📈"},
  {id:"settings",label:"Settings",icon:"⚙️"},
];

function AdminLayout({page,setPage,children}){
  const{logout}=useAuth();const[mob,setMob]=useState(false);
  const NL=({item})=><button onClick={()=>{setPage(item.id);setMob(false);}} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${page===item.id?"text-gray-900 shadow-lg":"text-gray-500 hover:bg-gray-100"}`} style={page===item.id?{background:GOLD}:{}}><span>{item.icon}</span><span>{item.label}</span></button>;
  return(
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-gray-100 fixed h-screen" style={{borderColor:'#e5e7eb'}}>
        <div className="p-4 border-b border-gray-100"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{background:GOLD}}>🎟️</div><div><p className="text-sm font-black" style={{color:NAVY}}>Campus Tix</p><p className="text-xs text-gray-400">Admin Portal</p></div></div></div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">{ADMIN_NAV.map(n=><NL key={n.id} item={n}/>)}</nav>
        <div className="p-3 border-t border-gray-100"><button onClick={logout} className="w-full px-3 py-2 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-left">🚪 Sign Out</button></div>
      </aside>
      {mob&&<div className="fixed inset-0 z-40 lg:hidden" onClick={()=>setMob(false)}><div className="absolute inset-0 bg-black/50"/><aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-2xl p-3" onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between px-2 py-2 mb-2"><p className="text-sm font-black" style={{color:NAVY}}>Campus Tix</p><button onClick={()=>setMob(false)} className="text-gray-400 text-lg">✕</button></div><nav className="space-y-0.5">{ADMIN_NAV.map(n=><NL key={n.id} item={n}/>)}</nav></aside></div>}
      <div className="flex-1 flex flex-col lg:ml-60">
        <header className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3"><button onClick={()=>setMob(true)} className="lg:hidden w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 text-sm">☰</button><h1 className="text-base font-bold text-gray-900">{ADMIN_NAV.find(n=>n.id===page)?.label||"Dashboard"}</h1></div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl">● Live</span>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────
function AdminDashboard({setPage}){
  const{data:events=[],loading:el}=useAsync(()=>eventsDB.getAll());
  const{data:sales=[],loading:sl}=useAsync(()=>salesDB.getAll());
  const{data:reps=[],loading:rl}=useAsync(()=>repsDB.getAll());
  const{data:cePoints=[]}=useAsync(()=>cePointsDB.getAll());
  const{data:commissions=[]}=useAsync(()=>coordCommissionsDB.getAll());
  const loading=el||sl||rl;
  const grossRev=sales.reduce((s,x)=>s+x.totalValue,0);
  const pointsDue=cePoints.filter(c=>c.status==="Due").reduce((s,c)=>s+c.pointsEarned,0);
  const commDue=commissions.filter(c=>c.status==="Due").reduce((s,c)=>s+c.amountDue,0);
  const activeEvents=events.filter(e=>e.status==="Active");
  return(
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Active Events" value={activeEvents.length} icon="🎉" color={NAVY} onClick={()=>setPage("events")} loading={loading}/>
        <StatCard title="Gross Revenue" value={fmt.currency(grossRev)} icon="💰" color="#059669" loading={loading}/>
        <StatCard title="CE Points Due" value={fmt.number(pointsDue)} icon="⭐" color={PURPLE} onClick={()=>setPage("cepoints")} loading={loading}/>
        <StatCard title="Commission Due" value={fmt.currency(commDue)} icon="💵" color="#d97706" onClick={()=>setPage("commissions")} loading={loading}/>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Reps" value={reps.filter(r=>r.status==="Active").length} icon="👥" color={NAVY} onClick={()=>setPage("reps")} loading={loading}/>
        <StatCard title="Total Sales" value={sales.length} icon="🎟️" color="#7c3aed" loading={loading}/>
        <StatCard title="Campus Tix Cut" value={fmt.currency(events.reduce((s,e)=>{const eS=sales.filter(x=>x.eventId===e.id).reduce((a,b)=>a+b.totalValue,0);return s+eS*e.commissionRate;},0))} icon="📊" color={NAVY} loading={loading}/>
        <StatCard title="Closed Events" value={events.filter(e=>e.status==="Closed").length} icon="🔒" color="#6b7280" loading={loading}/>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">Active Events</h3>
          {activeEvents.length===0?<EmptyState icon="🎉" title="No active events" message="Create an event to get started"/>:(
            <div className="space-y-3">{activeEvents.slice(0,5).map(e=>{const eS=sales.filter(x=>x.eventId===e.id);const rev=eS.reduce((s,x)=>s+x.totalValue,0);return(<div key={e.id} className="flex items-center gap-3 p-3 rounded-xl" style={{background:'#f8fafc'}}><div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{background:GOLD}}>🎉</div><div className="flex-1 min-w-0"><p className="font-semibold text-sm text-gray-900 truncate">{e.name}</p><p className="text-xs text-gray-400">{fmt.date(e.date)} · {eS.length} sales</p></div><span className="font-bold text-sm text-emerald-600">{fmt.currency(rev)}</span></div>);})}
          </div>)}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">Recent Sales</h3>
          {sales.length===0?<EmptyState icon="💰" title="No sales yet" message="Sales will appear here"/>:(
            <div className="space-y-3">{sales.slice(0,6).map((s,i)=>(<div key={i} className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0" style={{background:GOLD}}>🎟️</div><div className="flex-1 min-w-0"><p className="text-xs font-semibold text-gray-800 truncate">{s.eventName}</p><p className="text-xs text-gray-400">{s.repName} · {fmt.dateTime(s.dateSold)}</p></div><span className="text-sm font-bold text-emerald-600">{fmt.currency(s.totalValue)}</span></div>))}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN EVENTS ─────────────────────────────────────────────
function EventForm({initial,onSave,onClose,saving}){
  const[form,setForm]=useState(initial||{name:"",date:"",venue:"",promoterName:"",promoterPhone:"",ticketPrice:"",totalTickets:"",commissionRate:"10",pointsPerTicket:"10",status:"Draft"});
  const[errors,setErrors]=useState({});
  const isEdit=!!initial?.id;
  const validate=()=>{const e={};if(!form.name.trim())e.name="Required";if(!form.date)e.date="Required";if(!form.ticketPrice||Number(form.ticketPrice)<=0)e.ticketPrice="Required";if(!form.totalTickets||Number(form.totalTickets)<=0)e.totalTickets="Required";setErrors(e);return!Object.keys(e).length;};
  const submit=e=>{e.preventDefault();if(!validate())return;onSave({...form,ticketPrice:Number(form.ticketPrice),totalTickets:Number(form.totalTickets),commissionRate:Number(form.commissionRate)/100,pointsPerTicket:Number(form.pointsPerTicket)});};
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return(
    <form onSubmit={submit} className="space-y-4">
      <FF label="Event Name" required error={errors.name}><input className={iCls} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Event name"/></FF>
      <div className="grid grid-cols-2 gap-3">
        <FF label="Date" required error={errors.date}><input className={iCls} type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></FF>
        <FF label="Venue"><input className={iCls} value={form.venue} onChange={e=>set("venue",e.target.value)} placeholder="Venue name"/></FF>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FF label="Promoter Name"><input className={iCls} value={form.promoterName} onChange={e=>set("promoterName",e.target.value)} placeholder="Promoter name"/></FF>
        <FF label="Promoter Phone" hint="Tap to open WhatsApp"><input className={iCls} type="tel" value={form.promoterPhone} onChange={e=>set("promoterPhone",e.target.value)} placeholder="+1 876-555-0000"/></FF>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FF label="Ticket Price ($)" required error={errors.ticketPrice}><input className={iCls} type="number" min="0" step="0.01" value={form.ticketPrice} onChange={e=>set("ticketPrice",e.target.value)} placeholder="0.00"/></FF>
        <FF label="Total Tickets" required error={errors.totalTickets}><input className={iCls} type="number" min="1" value={form.totalTickets} onChange={e=>set("totalTickets",e.target.value)} placeholder="0"/></FF>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FF label="Campus Tix Commission %" hint="Default 10%"><input className={iCls} type="number" min="0" max="100" value={form.commissionRate} onChange={e=>set("commissionRate",e.target.value)} placeholder="10"/></FF>
        <FF label="CE Points per Ticket" hint="Default 10"><input className={iCls} type="number" min="1" value={form.pointsPerTicket} onChange={e=>set("pointsPerTicket",e.target.value)} placeholder="10"/></FF>
      </div>
      {isEdit&&<FF label="Status"><select className={iCls} value={form.status} onChange={e=>set("status",e.target.value)}><option>Draft</option><option>Active</option></select></FF>}
      <div className="flex gap-3 pt-1"><button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">Cancel</button><PBtn className="flex-1" loading={saving}>{isEdit?"Save Changes":"Create Event"}</PBtn></div>
    </form>
  );
}

function CloseOutEventModal({event,onClose,onConfirm,saving}){
  const[amount,setAmount]=useState("");
  return(
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-sm font-bold text-red-800">⚠️ Closing out this event is permanent</p>
        <p className="text-xs text-red-600 mt-1">All reps will be closed out. No further input will be possible. Coordinator commissions will become Due.</p>
      </div>
      <div className="bg-gray-50 rounded-xl p-3"><p className="font-semibold text-sm">{event.name}</p><p className="text-xs text-gray-500">{fmt.date(event.date)} · {event.venue}</p></div>
      <FF label="Amount Paid to Promoter ($)" required hint="Record the exact amount handed over"><input className={iCls} type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></FF>
      <div className="flex gap-3"><button onClick={onClose} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">Cancel</button><PBtn variant="danger" className="flex-1" loading={saving} onClick={()=>onConfirm(Number(amount))}>🔒 Close Out Event</PBtn></div>
    </div>
  );
}

function AdminEvents(){
  const{data:events=[],loading,reload}=useAsync(()=>eventsDB.getAll());
  const{data:sales=[]}=useAsync(()=>salesDB.getAll());
  const{data:coordinators=[]}=useAsync(()=>coordinatorsDB.getAll());
  const[modal,setModal]=useState(null);const[saving,setSaving]=useState(false);
  const[search,setSearch]=useState("");
  const{toast,show}=useToast();
  const filtered=events.filter(e=>e.name.toLowerCase().includes(search.toLowerCase())||e.venue?.toLowerCase().includes(search.toLowerCase()));
  const save=async form=>{setSaving(true);try{if(modal?.event){await eventsDB.update(modal.event.id,form);show("Event updated");}else{await eventsDB.create(form);show("Event created");}setModal(null);reload();}catch(e){show("Error: "+e.message);}setSaving(false);};
  const closeOut=async(event,amount)=>{setSaving(true);try{await eventsDB.closeOut(event.id,amount);await coordCommissionsDB.updateRevenue(event.id);show("Event closed out!");setModal(null);reload();}catch(e){show("Error: "+e.message);}setSaving(false);};
  const rows=filtered.map(e=>{
    const eS=sales.filter(x=>x.eventId===e.id);
    const rev=eS.reduce((s,x)=>s+x.totalValue,0);
    const cut=rev*e.commissionRate;
    return[
      <div><p className="font-semibold text-sm text-gray-900">{e.name}</p><p className="text-xs text-gray-400">{fmt.date(e.date)}</p></div>,
      <span className="text-sm text-gray-600">{e.venue||"—"}</span>,
      <span className="font-bold">{fmt.currency(e.ticketPrice)}</span>,
      <span className="text-sm">{e.totalTickets}</span>,
      <span className="font-bold text-emerald-600">{fmt.currency(rev)}</span>,
      <span className="text-sm text-blue-600">{fmt.currency(cut)}</span>,
      <EventStatusBadge status={e.status}/>,
      <div className="flex gap-1">
        {e.promoterPhone&&<a href={waLink(e.promoterPhone)} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 text-xs flex items-center justify-center" title="WhatsApp Promoter">📱</a>}
        {e.status!=="Closed"&&<button onClick={()=>setModal({type:"edit",event:e})} className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs flex items-center justify-center" title="Edit">✏️</button>}
        {e.status==="Draft"&&<button onClick={async()=>{await eventsDB.update(e.id,{status:"Active"});show("Event activated");reload();}} className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs flex items-center justify-center" title="Activate">▶️</button>}
        {e.status==="Active"&&<button onClick={()=>setModal({type:"closeout",event:e})} className="w-7 h-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs flex items-center justify-center" title="Close Out">🔒</button>}
        <button onClick={()=>setModal({type:"detail",event:e,sales:eS})} className="w-7 h-7 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 text-xs flex items-center justify-center" title="View">👁️</button>
      </div>
    ];
  });
  return(
    <div className="space-y-5">
      <SHeader title="Events" subtitle={`${events.length} events`} action={<PBtn onClick={()=>setModal({type:"create"})}>➕ New Event</PBtn>}/>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Search events..."/></div>
        <Table headers={["Event","Venue","Ticket Price","Total Tix","Revenue","CT Cut","Status","Actions"]} rows={rows} loading={loading} empty="No events yet"/>
      </div>
      <Modal isOpen={modal?.type==="create"||modal?.type==="edit"} onClose={()=>setModal(null)} title={modal?.type==="edit"?`Edit: ${modal.event?.name}`:"Create Event"} size="lg">
        <EventForm initial={modal?.event} onSave={save} onClose={()=>setModal(null)} saving={saving}/>
      </Modal>
      <Modal isOpen={modal?.type==="closeout"} onClose={()=>setModal(null)} title="Close Out Event" size="md">
        {modal?.event&&<CloseOutEventModal event={modal.event} onClose={()=>setModal(null)} onConfirm={amt=>closeOut(modal.event,amt)} saving={saving}/>}
      </Modal>
      <Modal isOpen={modal?.type==="detail"} onClose={()=>setModal(null)} title={modal?.event?.name||"Event Detail"} size="lg">
        {modal?.event&&(
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">Date</p><p className="font-semibold text-sm">{fmt.date(modal.event.date)}</p></div>
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">Venue</p><p className="font-semibold text-sm">{modal.event.venue||"—"}</p></div>
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">Promoter</p><p className="font-semibold text-sm">{modal.event.promoterName||"—"}</p>{modal.event.promoterPhone&&<WhatsAppBtn phone={modal.event.promoterPhone}/>}</div>
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">Ticket Price</p><p className="font-semibold text-sm">{fmt.currency(modal.event.ticketPrice)}</p></div>
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">Commission Rate</p><p className="font-semibold text-sm">{Math.round(modal.event.commissionRate*100)}%</p></div>
              <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">CE Points/Ticket</p><p className="font-semibold text-sm">{modal.event.pointsPerTicket} pts</p></div>
            </div>
            {modal.event.amountPaidToPromoter>0&&<div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3"><p className="text-xs text-emerald-600 font-semibold">Amount Paid to Promoter</p><p className="text-lg font-bold text-emerald-800">{fmt.currency(modal.event.amountPaidToPromoter)}</p></div>}
            <div className="space-y-2">{(modal.sales||[]).slice(0,5).map((s,i)=>(<div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded-xl"><div><p className="text-xs font-semibold">{s.repName}</p><p className="text-xs text-gray-400">{fmt.dateTime(s.dateSold)}</p></div><span className="text-sm font-bold text-emerald-600">{fmt.currency(s.totalValue)}</span></div>))}</div>
          </div>
        )}
      </Modal>
      <Toast message={toast.message} visible={toast.visible}/>
    </div>
  );
}

// ─── ADMIN COORDINATORS ───────────────────────────────────────
function CoordForm({initial,onSave,onClose,saving}){
  const[form,setForm]=useState(initial||{name:"",coordinatorId:"",phone:"",email:"",password:"",commissionRate:"15",status:"Active",mustChangePassword:true});
  const[errors,setErrors]=useState({});
  const isEdit=!!initial?.id;
  const validate=()=>{const e={};if(!form.name.trim())e.name="Required";if(!form.coordinatorId.trim())e.coordinatorId="Required";if(!form.email.trim())e.email="Required";if(!isEdit&&!form.password.trim())e.password="Required";setErrors(e);return!Object.keys(e).length;};
  const submit=e=>{e.preventDefault();if(!validate())return;onSave({...form,coordinatorId:form.coordinatorId.toUpperCase(),commissionRate:Number(form.commissionRate)/100});};
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return(
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FF label="Full Name" required error={errors.name}><input className={iCls} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Full name"/></FF>
        <FF label="Coordinator ID" required error={errors.coordinatorId}><input className={`${iCls} uppercase`} value={form.coordinatorId} onChange={e=>set("coordinatorId",e.target.value)} placeholder="COORD001" disabled={isEdit}/></FF>
      </div>
      <FF label="Phone"><input className={iCls} type="tel" value={form.phone||""} onChange={e=>set("phone",e.target.value)} placeholder="+1 876-555-0000"/></FF>
      <FF label="Email" required error={errors.email}><input className={iCls} type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="email@example.com"/></FF>
      <FF label={isEdit?"New Password (blank=keep)":"Temporary Password"} required={!isEdit} error={errors.password} hint="Coordinator sets own password on first login"><input className={iCls} type="password" value={form.password} onChange={e=>set("password",e.target.value)} placeholder="Temporary password"/></FF>
      <FF label="Commission Rate %" hint="% of Campus Tix cut they receive on all events"><input className={iCls} type="number" min="0" max="100" value={form.commissionRate} onChange={e=>set("commissionRate",e.target.value)} placeholder="15"/></FF>
      <FF label="Status"><select className={iCls} value={form.status} onChange={e=>set("status",e.target.value)}><option>Active</option><option>Inactive</option></select></FF>
      <div className="flex gap-3 pt-1"><button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">Cancel</button><PBtn className="flex-1" loading={saving}>{isEdit?"Save Changes":"Create Coordinator"}</PBtn></div>
    </form>
  );
}

function AdminCoordinators(){
  const{data:coordinators=[],loading,reload}=useAsync(()=>coordinatorsDB.getAll());
  const{data:events=[]}=useAsync(()=>eventsDB.getActive());
  const[modal,setModal]=useState(null);const[saving,setSaving]=useState(false);
  const[search,setSearch]=useState("");
  const{toast,show}=useToast();
  const filtered=coordinators.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.coordinatorId.toLowerCase().includes(search.toLowerCase()));
  const save=async form=>{setSaving(true);try{if(modal?.coord){const u={...form};if(!form.password)delete u.password;await coordinatorsDB.update(modal.coord.id,u);show("Coordinator updated");}else{await coordinatorsDB.create(form);show("Coordinator created");}setModal(null);reload();}catch(e){show("Error: "+e.message);}setSaving(false);};
  const rows=filtered.map(c=>[
    <div><p className="font-semibold text-gray-900 text-sm">{c.name}</p><p className="text-xs text-gray-400">{c.email}</p></div>,
    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded-lg">{c.coordinatorId}</span>,
    <WhatsAppBtn phone={c.phone}/>,
    <span className="font-semibold text-sm">{Math.round(c.commissionRate*100)}%</span>,
    <Badge label={c.status} type={c.status==="Active"?"success":"danger"}/>,
    c.mustChangePassword?<Badge label="Temp PW" type="warning"/>:<Badge label="PW Set" type="success"/>,
    <div className="flex gap-1">
      <button onClick={()=>setModal({type:"edit",coord:c})} className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs flex items-center justify-center" title="Edit">✏️</button>
      <button onClick={()=>setModal({type:"assign",coord:c})} className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 text-xs flex items-center justify-center" title="Assign Events">🎉</button>
      <button onClick={async()=>{await coordinatorsDB.update(c.id,{status:c.status==="Active"?"Inactive":"Active"});show("Status updated");reload();}} className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center ${c.status==="Active"?"bg-orange-50 text-orange-600":"bg-green-50 text-green-600"}`}>{c.status==="Active"?"🚫":"✅"}</button>
      <button onClick={()=>setModal({type:"delete",coord:c})} className="w-7 h-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs flex items-center justify-center" title="Delete">🗑️</button>
    </div>
  ]);
  return(
    <div className="space-y-5">
      <SHeader title="Coordinators" subtitle={`${coordinators.length} coordinators`} action={<PBtn onClick={()=>setModal({type:"create"})}>➕ Add Coordinator</PBtn>}/>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Search coordinators..."/></div>
        <Table headers={["Coordinator","ID","Phone","Commission","Status","Password","Actions"]} rows={rows} loading={loading} empty="No coordinators yet"/>
      </div>
      <Modal isOpen={modal?.type==="create"||modal?.type==="edit"} onClose={()=>setModal(null)} title={modal?.type==="edit"?`Edit: ${modal.coord?.name}`:"Add Coordinator"}>
        <CoordForm initial={modal?.coord} onSave={save} onClose={()=>setModal(null)} saving={saving}/>
      </Modal>
      <Modal isOpen={modal?.type==="assign"} onClose={()=>setModal(null)} title={`Assign Events: ${modal?.coord?.name}`} size="md">
        {modal?.coord&&<AssignCoordEvents coord={modal.coord} events={events} onClose={()=>setModal(null)} onShow={show}/>}
      </Modal>
      <ConfirmModal isOpen={modal?.type==="delete"} onClose={()=>setModal(null)} onConfirm={async()=>{await coordinatorsDB.delete(modal.coord.id);show("Coordinator deleted");reload();}} title="Delete Coordinator" message={`Delete ${modal?.coord?.name}?`} confirmLabel="Delete" danger/>
      <Toast message={toast.message} visible={toast.visible}/>
    </div>
  );
}

function AssignCoordEvents({coord,events,onClose,onShow}){
  const{data:assigned=[],loading,reload}=useAsync(()=>coordEventsDB.getByCoordinator(coord.id),[coord.id]);
  const[saving,setSaving]=useState(null);
  const assignedIds=(assigned||[]).map(a=>a.event_id);
  return(
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Select events to assign to <strong>{coord.name}</strong>. They will be able to manage all assigned events.</p>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {events.map(e=>{
          const isAssigned=assignedIds.includes(e.id);
          return(
            <div key={e.id} className="flex items-center justify-between p-3 rounded-xl border" style={{background:isAssigned?"#f0fdf4":"#f8fafc",borderColor:isAssigned?"#86efac":"#e5e7eb"}}>
              <div><p className="text-sm font-semibold text-gray-900">{e.name}</p><p className="text-xs text-gray-400">{fmt.date(e.date)}</p></div>
              <button onClick={async()=>{setSaving(e.id);try{if(isAssigned){await coordEventsDB.unassign(coord.id,e.id);onShow("Unassigned");} else {await coordEventsDB.assign(coord.id,e.id);const commission=await coordCommissionsDB.getOrCreate(coord.id,coord.name,e.id,e.name,coord.commissionRate);onShow("Assigned!");}reload();}catch(err){onShow("Error: "+err.message);}setSaving(null);}} disabled={saving===e.id} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isAssigned?"bg-red-50 text-red-600 hover:bg-red-100":"text-white"}`} style={!isAssigned?{background:NAVY}:{}}>{saving===e.id?<Spinner size="sm"/>:isAssigned?"Unassign":"Assign"}</button>
            </div>
          );
        })}
        {events.length===0&&<p className="text-sm text-gray-400 text-center py-4">No active events to assign</p>}
      </div>
      <button onClick={onClose} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">Done</button>
    </div>
  );
}

// ─── ADMIN REPS ───────────────────────────────────────────────
function RepForm({initial,onSave,onClose,saving}){
  const[form,setForm]=useState(initial||{name:"",repId:"",phone:"",email:"",password:"",university:"UWI Mona",residentCommuter:"Commuter",address:"",ceId:"",status:"Active",mustChangePassword:true});
  const[errors,setErrors]=useState({});
  const isEdit=!!initial?.id;
  const validate=()=>{const e={};if(!form.name.trim())e.name="Required";if(!form.repId.trim())e.repId="Required";if(!form.email.trim())e.email="Required";if(!isEdit&&!form.password.trim())e.password="Required";setErrors(e);return!Object.keys(e).length;};
  const submit=e=>{e.preventDefault();if(!validate())return;onSave({...form,repId:form.repId.toUpperCase()});};
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return(
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FF label="Full Name" required error={errors.name}><input className={iCls} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Full name"/></FF>
        <FF label="Rep ID" required error={errors.repId}><input className={`${iCls} uppercase`} value={form.repId} onChange={e=>set("repId",e.target.value)} placeholder="REP001" disabled={isEdit}/></FF>
      </div>
      <FF label="Phone" hint="Tap to open WhatsApp"><input className={iCls} type="tel" value={form.phone||""} onChange={e=>set("phone",e.target.value)} placeholder="+1 876-555-0000"/></FF>
      <FF label="Email" required error={errors.email}><input className={iCls} type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="email@example.com"/></FF>
      <FF label="University" required><select className={iCls} value={form.university} onChange={e=>set("university",e.target.value)}>{UNIVERSITIES.map(u=><option key={u}>{u}</option>)}</select></FF>
      <div className="grid grid-cols-2 gap-3">
        <FF label="Resident / Commuter"><select className={iCls} value={form.residentCommuter} onChange={e=>set("residentCommuter",e.target.value)}><option>Commuter</option><option>Resident</option></select></FF>
        <FF label="Campus Elite ID" hint="CE ID for points transfer"><input className={iCls} value={form.ceId||""} onChange={e=>set("ceId",e.target.value)} placeholder="CE-XXXXX"/></FF>
      </div>
      <FF label="Address"><input className={iCls} value={form.address||""} onChange={e=>set("address",e.target.value)} placeholder="Full address"/></FF>
      <FF label={isEdit?"New Password (blank=keep)":"Temporary Password"} required={!isEdit} error={errors.password} hint="Rep sets own password on first login"><input className={iCls} type="password" value={form.password} onChange={e=>set("password",e.target.value)} placeholder="Temporary password"/></FF>
      <div className="flex gap-3 pt-1"><button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">Cancel</button><PBtn className="flex-1" loading={saving}>{isEdit?"Save Changes":"Create Rep"}</PBtn></div>
    </form>
  );
}

function AdminReps(){
  const{data:reps=[],loading,reload}=useAsync(()=>repsDB.getAll());
  const[modal,setModal]=useState(null);const[saving,setSaving]=useState(false);
  const[search,setSearch]=useState("");
  const{toast,show}=useToast();
  const filtered=reps.filter(r=>r.name.toLowerCase().includes(search.toLowerCase())||r.repId.toLowerCase().includes(search.toLowerCase())||r.university?.toLowerCase().includes(search.toLowerCase()));
  const save=async form=>{setSaving(true);try{if(modal?.rep){const u={...form};if(!form.password)delete u.password;await repsDB.update(modal.rep.id,u);show("Rep updated");}else{await repsDB.create(form);show("Rep created");}setModal(null);reload();}catch(e){show("Error: "+e.message);}setSaving(false);};
  const rows=filtered.map(r=>[
    <div><p className="font-semibold text-gray-900 text-sm">{r.name}</p><p className="text-xs text-gray-400">{r.university}</p></div>,
    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded-lg">{r.repId}</span>,
    <WhatsAppBtn phone={r.phone}/>,
    <span className="text-xs text-gray-600">{r.residentCommuter}</span>,
    <span className="text-xs font-mono text-purple-600">{r.ceId||"—"}</span>,
    <Badge label={r.status} type={r.status==="Active"?"success":"danger"}/>,
    r.mustChangePassword?<Badge label="Temp PW" type="warning"/>:<Badge label="PW Set" type="success"/>,
    <div className="flex gap-1">
      <button onClick={()=>setModal({type:"view",rep:r})} className="w-7 h-7 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 text-xs flex items-center justify-center" title="View">👁️</button>
      <button onClick={()=>setModal({type:"edit",rep:r})} className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs flex items-center justify-center" title="Edit">✏️</button>
      <button onClick={async()=>{await repsDB.update(r.id,{status:r.status==="Active"?"Inactive":"Active"});show("Status updated");reload();}} className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center ${r.status==="Active"?"bg-orange-50 text-orange-600":"bg-green-50 text-green-600"}`}>{r.status==="Active"?"🚫":"✅"}</button>
      <button onClick={()=>setModal({type:"delete",rep:r})} className="w-7 h-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs flex items-center justify-center" title="Delete">🗑️</button>
    </div>
  ]);
  return(
    <div className="space-y-5">
      <SHeader title="Sales Reps" subtitle={`${reps.length} reps`} action={<PBtn onClick={()=>setModal({type:"create"})}>➕ Add Rep</PBtn>}/>
      {reps.filter(r=>r.status==="Pending Approval").length>0&&(
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="font-bold text-amber-800 mb-3">⏳ Pending Approval ({reps.filter(r=>r.status==="Pending Approval").length})</p>
          <div className="space-y-2">
            {reps.filter(r=>r.status==="Pending Approval").map(r=>(
              <div key={r.id} className="bg-white rounded-xl p-3 flex items-center justify-between border border-amber-200">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{r.name}</p>
                  <p className="text-xs text-gray-400">{r.university} · {r.email}</p>
                  {r.phone&&<WhatsAppBtn phone={r.phone}/>}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <button onClick={async()=>{
                    const newRepId="REP"+String(reps.filter(x=>x.status==="Active").length+1).padStart(3,"0");
                    await repsDB.update(r.id,{status:"Active",repId:newRepId,mustChangePassword:true});
                    show(`${r.name} approved as ${newRepId}`);reload();
                  }} className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style={{background:NAVY}}>✅ Approve</button>
                  <button onClick={async()=>{await repsDB.delete(r.id);show("Rep rejected");reload();}} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100">❌ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Search reps, university..."/></div>
        <Table headers={["Rep","ID","Phone","Type","CE ID","Status","Password","Actions"]} rows={rows} loading={loading} empty="No reps yet"/>
      </div>
      <Modal isOpen={modal?.type==="create"||modal?.type==="edit"} onClose={()=>setModal(null)} title={modal?.type==="edit"?`Edit: ${modal.rep?.name}`:"Add Sales Rep"} size="lg">
        <RepForm initial={modal?.rep} onSave={save} onClose={()=>setModal(null)} saving={saving}/>
      </Modal>
      <Modal isOpen={modal?.type==="view"} onClose={()=>setModal(null)} title={modal?.rep?.name||"Rep Profile"} size="md">
        {modal?.rep&&(
          <div className="space-y-3">
            {[["University",modal.rep.university],["Type",modal.rep.residentCommuter],["Address",modal.rep.address||"—"],["CE ID",modal.rep.ceId||"—"],["Email",modal.rep.email]].map(([l,v])=><div key={l} className="flex justify-between py-2 border-b border-gray-50"><span className="text-sm text-gray-500">{l}</span><span className="text-sm font-semibold text-gray-800">{v}</span></div>)}
            <div className="flex justify-between py-2"><span className="text-sm text-gray-500">Phone</span><WhatsAppBtn phone={modal.rep.phone}/></div>
          </div>
        )}
      </Modal>
      <ConfirmModal isOpen={modal?.type==="delete"} onClose={()=>setModal(null)} onConfirm={async()=>{await repsDB.delete(modal.rep.id);show("Rep deleted");reload();}} title="Delete Rep" message={`Delete ${modal?.rep?.name}?`} confirmLabel="Delete" danger/>
      <Toast message={toast.message} visible={toast.visible}/>
    </div>
  );
}

// ─── ADMIN REP INVENTORY ──────────────────────────────────────
function AdminRepInventory(){
  const{data:inventory=[],loading,reload}=useAsync(()=>inventoryDB.getAll());
  const{data:events=[]}=useAsync(()=>eventsDB.getAll());
  const{data:reps=[]}=useAsync(()=>repsDB.getAll());
  const[filterEvent,setFilterEvent]=useState("");
  const[modal,setModal]=useState(null);const[saving,setSaving]=useState(false);
  const[allocForm,setAllocForm]=useState({repId:"",qty:""});
  const{toast,show}=useToast();
  const filtered=filterEvent?inventory.filter(i=>i.eventId===filterEvent):inventory;
  const activeReps=reps.filter(r=>r.status==="Active");
  const rows=filtered.map(inv=>[
    <div><p className="font-semibold text-sm">{inv.repName}</p><p className="text-xs text-gray-400">{inv.repId}</p></div>,
    <span className="text-sm">{inv.eventName}</span>,
    <span className="font-semibold">{inv.ticketsAllocated}</span>,
    <span className="text-emerald-600 font-semibold">{inv.ticketsSold}</span>,
    <span className={`font-bold ${inv.ticketsRemaining===0?"text-red-600":inv.ticketsRemaining<=3?"text-amber-600":"text-gray-900"}`}>{inv.ticketsRemaining}</span>,
    <span className="font-semibold text-emerald-600">{fmt.currency(inv.cashCollected)}</span>,
    inv.confirmed?<Badge label="Confirmed ✓" type="success"/>:<Badge label="Pending" type="warning"/>,
    <Badge label={inv.status} type={inv.status==="Active"?"success":"danger"}/>,
  ]);
  return(
    <div className="space-y-5">
      <SHeader title="Rep Inventory" subtitle="Ticket allocations per rep per event" action={<PBtn onClick={()=>setModal({type:"allocate"})}>🎟️ Allocate Tickets</PBtn>}/>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="mb-4"><select className={iCls} value={filterEvent} onChange={e=>setFilterEvent(e.target.value)}><option value="">All Events</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
        <Table headers={["Rep","Event","Allocated","Sold","Remaining","Cash Collected","Confirmed","Status"]} rows={rows} loading={loading} empty="No ticket inventory yet. Allocate tickets to reps."/>
      </div>
      <Modal isOpen={modal?.type==="allocate"} onClose={()=>setModal(null)} title="Allocate Tickets to Rep" size="md">
        <div className="space-y-4">
          <FF label="Event" required><select className={iCls} value={allocForm.eventId||""} onChange={e=>setAllocForm(f=>({...f,eventId:e.target.value}))}><option value="">Select event...</option>{events.filter(e=>e.status==="Active").map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></FF>
          <FF label="Rep" required><select className={iCls} value={allocForm.repId} onChange={e=>{const rep=activeReps.find(r=>r.id===e.target.value);setAllocForm(f=>({...f,repId:e.target.value,repName:rep?.name,repRepId:rep?.repId}));}}><option value="">Select rep...</option>{activeReps.map(r=><option key={r.id} value={r.id}>{r.name} ({r.repId})</option>)}</select></FF>
          <FF label="Tickets to Allocate" required><input className={iCls} type="number" min="1" value={allocForm.qty} onChange={e=>setAllocForm(f=>({...f,qty:e.target.value}))} placeholder="0"/></FF>
          <div className="flex gap-3"><button onClick={()=>setModal(null)} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">Cancel</button><PBtn className="flex-1" loading={saving} onClick={async()=>{if(!allocForm.eventId||!allocForm.repId||!allocForm.qty){show("Fill all fields");return;}setSaving(true);try{const ev=events.find(e=>e.id===allocForm.eventId);await inventoryDB.create({repId:allocForm.repRepId,repName:allocForm.repName,eventId:allocForm.eventId,eventName:ev?.name||"",ticketsAllocated:Number(allocForm.qty)});await cePointsDB.getOrCreate(allocForm.repRepId,allocForm.repName,allocForm.eventId,ev?.name||"",ev?.pointsPerTicket||10,activeReps.find(r=>r.id===allocForm.repId)?.ceId||"");show("Tickets allocated!");setModal(null);setAllocForm({repId:"",qty:""});reload();}catch(e){show("Error: "+e.message);}setSaving(false);}}>Allocate Tickets</PBtn></div>
        </div>
      </Modal>
      <Toast message={toast.message} visible={toast.visible}/>
    </div>
  );
}

// ─── ADMIN SALES ──────────────────────────────────────────────
function AdminSales(){
  const{data:sales=[],loading}=useAsync(()=>salesDB.getAll());
  const{data:events=[]}=useAsync(()=>eventsDB.getAll());
  const[filterEvent,setFilterEvent]=useState("");const[search,setSearch]=useState("");
  const filtered=sales.filter(s=>(!filterEvent||s.eventId===filterEvent)&&(!search||s.repName.toLowerCase().includes(search.toLowerCase())||s.eventName.toLowerCase().includes(search.toLowerCase())));
  const totalRev=filtered.reduce((s,x)=>s+x.totalValue,0);
  const rows=filtered.slice(0,100).map(s=>[
    <div><p className="font-semibold text-sm">{s.eventName}</p><p className="text-xs text-gray-400">Wk {s.weekNumber}</p></div>,
    <span className="text-sm">{s.repName}</span>,
    <span className="font-semibold">{s.quantitySold}</span>,
    <span className="font-bold text-emerald-600">{fmt.currency(s.totalValue)}</span>,
    <Badge label={s.paymentMethod} type={s.paymentMethod==="Cash"?"success":"info"}/>,
    <span className="text-xs text-gray-500">{fmt.dateTime(s.dateSold)}</span>,
  ]);
  return(
    <div className="space-y-5">
      <SHeader title="Sales" subtitle={`${sales.length} total · ${fmt.currency(totalRev)}`}/>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Sales" value={sales.length} icon="🎟️" color={NAVY} loading={loading}/>
        <StatCard title="Total Revenue" value={fmt.currency(sales.reduce((s,x)=>s+x.totalValue,0))} icon="💰" color="#059669" loading={loading}/>
        <StatCard title="Tickets Sold" value={fmt.number(sales.reduce((s,x)=>s+x.quantitySold,0))} icon="📊" color={PURPLE} loading={loading}/>
        <StatCard title="Avg Sale" value={fmt.currency(sales.length>0?sales.reduce((s,x)=>s+x.totalValue,0)/sales.length:0)} icon="📈" color="#d97706" loading={loading}/>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Search rep, event..."/></div>
          <select className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none bg-white" value={filterEvent} onChange={e=>setFilterEvent(e.target.value)}><option value="">All Events</option>{events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
        </div>
        <Table headers={["Event","Rep","Qty","Total","Payment","Date"]} rows={rows} loading={loading} empty="No sales yet"/>
      </div>
    </div>
  );
}

// ─── ADMIN CE POINTS ──────────────────────────────────────────
function AdminCEPoints(){
  const{data:points=[],loading,reload}=useAsync(()=>cePointsDB.getAll());
  const{toast,show}=useToast();
  const[filter,setFilter]=useState("All");
  const filtered=filter==="All"?points:points.filter(p=>p.status===filter);
  const totalDue=points.filter(p=>p.status==="Due").reduce((s,p)=>s+p.pointsEarned,0);
  const totalPaid=points.filter(p=>p.status==="Paid").reduce((s,p)=>s+p.pointsEarned,0);
  const rows=filtered.map(p=>[
    <div><p className="font-semibold text-sm">{p.repName}</p><p className="text-xs text-gray-400">{p.repId}</p></div>,
    <span className="text-xs font-mono text-purple-600">{p.ceId||"—"}</span>,
    <span className="text-sm">{p.eventName}</span>,
    <span className="font-semibold">{p.ticketsSold}</span>,
    <span className="font-bold text-yellow-600">{fmt.number(p.pointsEarned)} pts</span>,
    <CEBadge status={p.status}/>,
    p.paidAt?<span className="text-xs text-gray-400">{fmt.date(p.paidAt)}</span>:<span/>,
    p.status==="Due"?<button onClick={async()=>{await cePointsDB.markPaid(p.id,"Admin");show(`CE Points sent to ${p.repName}`);reload();}} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-900" style={{background:GOLD}}>⭐ Send Points</button>:<span/>
  ]);
  return(
    <div className="space-y-5">
      <SHeader title="CE Points" subtitle="Campus Elite points per rep per event"/>
      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Points Due" value={fmt.number(totalDue)+" pts"} icon="🔴" color="#dc2626" loading={loading}/>
        <StatCard title="Points Sent" value={fmt.number(totalPaid)+" pts"} icon="✅" color="#059669" loading={loading}/>
        <StatCard title="Pending" value={points.filter(p=>p.status==="Pending").length} icon="⏳" color="#d97706" loading={loading}/>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex gap-2 mb-4 flex-wrap">{["All","Pending","Due","Paid"].map(f=><button key={f} onClick={()=>setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filter===f?"text-gray-900":"bg-gray-100 text-gray-600"}`} style={filter===f?{background:GOLD}:{}}>{f}</button>)}</div>
        <Table headers={["Rep","CE ID","Event","Tix Sold","Points","Status","Sent Date","Action"]} rows={rows} loading={loading} empty="No CE points records yet."/>
      </div>
      <Toast message={toast.message} visible={toast.visible}/>
    </div>
  );
}

// ─── ADMIN COMMISSIONS ────────────────────────────────────────
function AdminCommissions(){
  const{data:commissions=[],loading,reload}=useAsync(()=>coordCommissionsDB.getAll());
  const{toast,show}=useToast();
  const[filter,setFilter]=useState("All");
  const filtered=filter==="All"?commissions:commissions.filter(c=>c.status===filter);
  const totalDue=commissions.filter(c=>c.status==="Due").reduce((s,c)=>s+c.amountDue,0);
  const totalPaid=commissions.filter(c=>c.status==="Paid").reduce((s,c)=>s+c.amountDue,0);
  const rows=filtered.map(c=>[
    <div><p className="font-semibold text-sm">{c.coordinatorName}</p><p className="text-xs text-gray-400">{c.coordinatorId}</p></div>,
    <span className="text-sm">{c.eventName}</span>,
    <span className="text-sm">{Math.round(c.commissionRate*100)}%</span>,
    <span className="text-sm text-gray-600">{fmt.currency(c.revenueBase)}</span>,
    <span className="font-bold text-emerald-600">{fmt.currency(c.amountDue)}</span>,
    <CEBadge status={c.status}/>,
    c.paidAt?<span className="text-xs text-gray-400">{fmt.date(c.paidAt)}</span>:<span/>,
    c.status==="Due"?<button onClick={async()=>{await coordCommissionsDB.markPaid(c.id,"Admin");show(`Paid ${c.coordinatorName}`);reload();}} className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600">Mark Paid</button>:<span/>
  ]);
  return(
    <div className="space-y-5">
      <SHeader title="Coordinator Commissions" subtitle="% of Campus Tix cut per coordinator per event"/>
      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Commission Due" value={fmt.currency(totalDue)} icon="🔴" color="#dc2626" loading={loading}/>
        <StatCard title="Commission Paid" value={fmt.currency(totalPaid)} icon="✅" color="#059669" loading={loading}/>
        <StatCard title="Pending" value={commissions.filter(c=>c.status==="Pending").length} icon="⏳" color="#d97706" loading={loading}/>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex gap-2 mb-4 flex-wrap">{["All","Pending","Due","Paid"].map(f=><button key={f} onClick={()=>setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filter===f?"text-gray-900":"bg-gray-100 text-gray-600"}`} style={filter===f?{background:GOLD}:{}}>{f}</button>)}</div>
        <Table headers={["Coordinator","Event","Rate","Revenue Base","Amount Due","Status","Paid","Action"]} rows={rows} loading={loading} empty="No commissions yet."/>
      </div>
      <Toast message={toast.message} visible={toast.visible}/>
    </div>
  );
}

// ─── ADMIN REPORTS ────────────────────────────────────────────
function AdminReports(){
  const{data:sales=[],loading:sl}=useAsync(()=>salesDB.getAll());
  const{data:events=[],loading:el}=useAsync(()=>eventsDB.getAll());
  const{data:reps=[],loading:rl}=useAsync(()=>repsDB.getAll());
  const{data:points=[]}=useAsync(()=>cePointsDB.getAll());
  const{data:commissions=[]}=useAsync(()=>coordCommissionsDB.getAll());
  const{data:inventory=[]}=useAsync(()=>inventoryDB.getAll());
  const loading=sl||el||rl;
  const RC=({title,desc,icon,onCSV})=><div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"><div className="flex items-start gap-4 mb-4"><div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0" style={{background:GOLD}}>{icon}</div><div className="flex-1"><h3 className="font-bold text-gray-900">{title}</h3><p className="text-xs text-gray-500 mt-0.5">{desc}</p></div></div><button onClick={onCSV} disabled={loading} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 disabled:opacity-50">📄 Export CSV</button></div>;
  return(
    <div className="space-y-5">
      <SHeader title="Reports" subtitle="Export live data"/>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RC title="Sales by Event" desc={`${sales.length} total sales`} icon="🎟️" onCSV={()=>downloadCSV(`sales_${new Date().toISOString().slice(0,10)}.csv`,["Event","Rep ID","Rep","Qty","Total","Payment","Date","Week"],sales.map(s=>[s.eventName,s.repId,s.repName,s.quantitySold,fmt.currency(s.totalValue),s.paymentMethod,fmt.date(s.dateSold),s.weekNumber]))}/>
        <RC title="CE Points Report" desc={`${points.length} records`} icon="⭐" onCSV={()=>downloadCSV(`ce_points_${new Date().toISOString().slice(0,10)}.csv`,["Rep ID","Rep","CE ID","Event","Tix Sold","Points","Status","Paid Date"],points.map(p=>[p.repId,p.repName,p.ceId||"",p.eventName,p.ticketsSold,p.pointsEarned,p.status,fmt.date(p.paidAt)]))}/>
        <RC title="Coordinator Commissions" desc={`${commissions.length} records`} icon="💵" onCSV={()=>downloadCSV(`commissions_${new Date().toISOString().slice(0,10)}.csv`,["Coordinator","Event","Rate","Revenue Base","Amount Due","Status","Paid Date"],commissions.map(c=>[c.coordinatorName,c.eventName,`${Math.round(c.commissionRate*100)}%`,fmt.currency(c.revenueBase),fmt.currency(c.amountDue),c.status,fmt.date(c.paidAt)]))}/>
        <RC title="Event Reconciliation" desc="Full per-rep breakdown per event" icon="📊" onCSV={()=>downloadCSV(`reconciliation_${new Date().toISOString().slice(0,10)}.csv`,["Event","Rep ID","Rep","Allocated","Sold","Returned","Remaining","Cash Collected","CE Points","CE Status"],inventory.map(i=>{const ce=points.find(p=>p.repId===i.repId&&p.eventId===i.eventId);return[i.eventName,i.repId,i.repName,i.ticketsAllocated,i.ticketsSold,i.ticketsReturned,i.ticketsRemaining,fmt.currency(i.cashCollected),ce?.pointsEarned||0,ce?.status||"—"];}))}/>
        <RC title="Rep Performance" desc={`${reps.length} reps`} icon="👥" onCSV={()=>downloadCSV(`reps_${new Date().toISOString().slice(0,10)}.csv`,["Rep ID","Name","University","Type","CE ID","Email","Phone","Total Sales","Tickets Sold","Revenue"],reps.map(r=>{const rs=sales.filter(s=>s.repId===r.repId);return[r.repId,r.name,r.university,r.residentCommuter,r.ceId||"",r.email,r.phone,rs.length,rs.reduce((s,x)=>s+x.quantitySold,0),fmt.currency(rs.reduce((s,x)=>s+x.totalValue,0))];}))}/> 
        <RC title="Weekly Sales Breakdown" desc="Sales grouped by week per event" icon="📅" onCSV={()=>{const rows=[];events.forEach(e=>{const eS=sales.filter(s=>s.eventId===e.id);const weeks=[...new Set(eS.map(s=>s.weekNumber))].sort();weeks.forEach(w=>{const wS=eS.filter(s=>s.weekNumber===w);rows.push([e.name,`Week ${w}`,wS.length,wS.reduce((s,x)=>s+x.quantitySold,0),fmt.currency(wS.reduce((s,x)=>s+x.totalValue,0))]);});});downloadCSV(`weekly_${new Date().toISOString().slice(0,10)}.csv`,["Event","Week","Sales","Tickets","Revenue"],rows);}}/>
      </div>
    </div>
  );
}

// ─── ADMIN SETTINGS ───────────────────────────────────────────
function AdminSettings(){
  const[modal,setModal]=useState(null);
  const{toast,show}=useToast();
  const deleteAll=async(tables)=>{for(const t of tables){try{await fetch(`${SUPABASE_URL}/rest/v1/${t}?id=neq.00000000-0000-0000-0000-000000000000`,{method:'DELETE',headers:{'apikey':SUPABASE_ANON_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`}});}catch{}}};
  return(
    <div className="space-y-5">
      <SHeader title="Settings" subtitle="System configuration"/>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">System Information</h3>
        <div className="space-y-3">{[["Application","Campus Tix"],["Version","1.0.0 — Cloud Edition"],["Database","Supabase (PostgreSQL)"],["Default CE Points","10 per ticket (editable per event)"],["Default Commission","10% (editable per event)"],["Default Coordinator Rate","15% of commission (editable per coordinator)"]].map(([l,v])=><div key={l} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"><span className="text-sm text-gray-500">{l}</span><span className="text-sm font-semibold text-gray-800">{v}</span></div>)}</div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-5">
        <h3 className="font-bold text-red-600 mb-4">⚠️ Danger Zone</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div><p className="text-sm font-semibold text-gray-800">Reset All Sales Data</p><p className="text-xs text-gray-500 mt-0.5">Clears sales, CE points, commissions, inventory. Keeps events, reps, coordinators.</p></div>
            <button onClick={()=>setModal("sales")} className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl ml-4 flex-shrink-0">Reset</button>
          </div>
          <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
            <div><p className="text-sm font-semibold text-gray-800">Wipe Everything</p><p className="text-xs text-gray-500 mt-0.5">Deletes ALL data. Cannot be undone.</p></div>
            <button onClick={()=>setModal("all")} className="px-4 py-2 bg-red-700 text-white text-sm font-semibold rounded-xl ml-4 flex-shrink-0">Wipe</button>
          </div>
        </div>
      </div>
      <ConfirmModal isOpen={modal==="sales"} onClose={()=>setModal(null)} onConfirm={async()=>{await deleteAll(['ct_sales','ct_ce_points','ct_coordinator_commissions','ct_rep_inventory','ct_return_inventory']);show("Sales data reset!");setTimeout(()=>window.location.reload(),1500);}} title="Reset Sales Data" message="This will delete all sales, CE points, commissions and inventory. Events, reps and coordinators are kept. Cannot be undone." confirmLabel="Reset Sales Data" danger/>
      <ConfirmModal isOpen={modal==="all"} onClose={()=>setModal(null)} onConfirm={async()=>{await deleteAll(['ct_sales','ct_ce_points','ct_coordinator_commissions','ct_rep_inventory','ct_return_inventory','ct_coordinator_events','ct_events','ct_reps','ct_coordinators']);show("Everything wiped!");setTimeout(()=>window.location.reload(),1500);}} title="Wipe Everything" message="This deletes ALL data including events, reps and coordinators. This CANNOT be undone." confirmLabel="Yes, Wipe Everything" danger/>
      <Toast message={toast.message} visible={toast.visible}/>
    </div>
  );
}

// ─── COORDINATOR DASHBOARD ────────────────────────────────────
function CoordinatorDashboard(){
  const{user,logout}=useAuth();
  const[screen,setScreen]=useState("home");
  const[selectedEvent,setSelectedEvent]=useState(null);
  const{data:coordInfo}=useAsync(()=>coordinatorsDB.getById(user.id),[user.id]);
  const{data:assignedEvents=[]}=useAsync(()=>coordEventsDB.getByCoordinator(user.id),[user.id]);
  const{data:allEvents=[]}=useAsync(()=>eventsDB.getAll());
  const{data:commissions=[]}=useAsync(()=>coordCommissionsDB.getByCoordinator(user.id),[user.id]);
  const myEventIds=(assignedEvents||[]).map(a=>a.event_id);
  const myEvents=allEvents.filter(e=>myEventIds.includes(e.id));
  const dueComm=commissions.filter(c=>c.status==="Due").reduce((s,c)=>s+c.amountDue,0);
  if(user.mustChangePassword)return <ChangePasswordScreen dbId={user.id} userType="coordinator" onDone={()=>window.location.reload()}/>;
  return(
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {screen!=="home"&&<button onClick={()=>{setScreen("home");setSelectedEvent(null);}} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-700">←</button>}
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{background:GOLD}}>🎯</div>
          <div><p className="text-sm font-bold" style={{color:NAVY}}>{screen==="home"?`Hi, ${user.name.split(" ")[0]}!`:screen==="event-detail"?selectedEvent?.name:"Campus Tix"}</p><p className="text-xs text-gray-400">Coordinator</p></div>
        </div>
        <div className="flex items-center gap-2">
          {dueComm>0&&<span className="text-xs font-bold px-2 py-1 rounded-lg text-white" style={{background:"#dc2626"}}>💵 {fmt.currency(dueComm)} Due</span>}
          <button onClick={logout} className="flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg" style={{background:NAVY}}>🚪 Sign Out</button>
        </div>
      </header>
      <main className="px-4 py-5 max-w-2xl mx-auto">
        {screen==="home"&&(
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard title="My Events" value={myEvents.length} icon="🎉" color={NAVY}/>
              <StatCard title="Commission Due" value={fmt.currency(dueComm)} icon="💵" color={PURPLE}/>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700 mb-3">My Events</p>
              <div className="space-y-3">
                {myEvents.map(e=>(
                  <button key={e.id} onClick={()=>{setSelectedEvent(e);setScreen("event-detail");}} className="w-full text-left p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{background:GOLD}}>🎉</div>
                      <div className="flex-1 min-w-0"><p className="font-bold text-gray-900">{e.name}</p><p className="text-xs text-gray-400">{fmt.date(e.date)} · {e.venue}</p></div>
                      <EventStatusBadge status={e.status}/>
                    </div>
                  </button>
                ))}
                {myEvents.length===0&&<EmptyState icon="🎉" title="No events assigned" message="Ask admin to assign you to events"/>}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700 mb-3">My Commission</p>
              <div className="space-y-2">
                {commissions.map(c=>(
                  <div key={c.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                    <div><p className="text-sm font-semibold">{c.eventName}</p><p className="text-xs text-gray-400">{Math.round(c.commissionRate*100)}% of CT cut</p></div>
                    <div className="flex items-center gap-2"><span className="font-bold text-sm text-emerald-600">{fmt.currency(c.amountDue)}</span><CEBadge status={c.status}/></div>
                  </div>
                ))}
                {commissions.length===0&&<p className="text-sm text-gray-400 text-center py-4">No commission records yet</p>}
              </div>
            </div>
          </div>
        )}
        {screen==="event-detail"&&selectedEvent&&<CoordEventDetail event={selectedEvent} coordId={user.id} coordName={user.name} onBack={()=>{setScreen("home");setSelectedEvent(null);}}/>}
      </main>
    </div>
  );
}

function CoordEventDetail({event,coordId,coordName,onBack}){
  const[tab,setTab]=useState("reps");
  const{data:allReps=[],loading:rl}=useAsync(()=>repsDB.getAll());
  const{data:inventory=[],loading:il,reload:reloadInv}=useAsync(()=>inventoryDB.getByEvent(event.id),[event.id]);
  const{data:sales=[],loading:sl}=useAsync(()=>salesDB.getByEvent(event.id),[event.id]);
  const{data:cePoints=[],loading:cl,reload:reloadCE}=useAsync(()=>cePointsDB.getByEvent(event.id),[event.id]);
  const{data:returnInv=[],reload:reloadReturn}=useAsync(()=>returnInventoryDB.getByEvent(event.id),[event.id]);
  const{toast,show}=useToast();
  const[modal,setModal]=useState(null);const[saving,setSaving]=useState(null);
  const[allocForm,setAllocForm]=useState({repId:"",qty:""});
  const isClosed=event.status==="Closed";
  const weeklyData=()=>{const m={};sales.forEach(s=>{const k=`Week ${s.weekNumber}`;if(!m[k])m[k]={week:k,sales:0,tickets:0,revenue:0};m[k].sales++;m[k].tickets+=s.quantitySold;m[k].revenue+=s.totalValue;});return Object.values(m).sort((a,b)=>a.week.localeCompare(b.week));};
  const TABS=["reps","sales","returns","cepoints","reconciliation"];
  const TLABELS={reps:"Reps",sales:"Sales",returns:"Returns",cepoints:"CE Points",reconciliation:"Reconciliation"};
  return(
    <div className="space-y-4">
      <div className="p-4 rounded-2xl text-white" style={{background:NAVY}}>
        <div className="flex justify-between items-start"><div><p className="font-black text-lg">{event.name}</p><p className="text-blue-200 text-sm">{fmt.date(event.date)} · {event.venue}</p></div><EventStatusBadge status={event.status}/></div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="bg-white/10 rounded-xl p-2 text-center"><p className="text-xs text-blue-200">Ticket Price</p><p className="font-bold">{fmt.currency(event.ticketPrice)}</p></div>
          <div className="bg-white/10 rounded-xl p-2 text-center"><p className="text-xs text-blue-200">Revenue</p><p className="font-bold">{fmt.currency(sales.reduce((s,x)=>s+x.totalValue,0))}</p></div>
          <div className="bg-white/10 rounded-xl p-2 text-center"><p className="text-xs text-blue-200">Tix Sold</p><p className="font-bold">{sales.reduce((s,x)=>s+x.quantitySold,0)}</p></div>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">{TABS.map(t=><button key={t} onClick={()=>setTab(t)} className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${tab===t?"text-gray-900":"bg-gray-100 text-gray-600"}`} style={tab===t?{background:GOLD}:{}}>{TLABELS[t]}</button>)}</div>

      {tab==="reps"&&(
        <div className="space-y-3">
          {!isClosed&&(
            <div className="grid grid-cols-2 gap-2">
              <PBtn className="w-full" onClick={()=>setModal("allocate")}>🎟️ Allocate Tickets</PBtn>
              <PBtn variant="outline" className="w-full" onClick={()=>setModal("suggest-rep")}>➕ Suggest Rep</PBtn>
            </div>
          )}
          {inventory.map(inv=>{
            const rep=allReps.find(r=>r.repId===inv.repId);
            return(
              <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{inv.repName}</p>
                    <p className="text-xs text-gray-400">{inv.repId}</p>
                    {rep?.phone&&<WhatsAppBtn phone={rep.phone}/>}
                  </div>
                  <div className="flex flex-col items-end gap-1"><Badge label={inv.status} type={inv.status==="Active"?"success":"danger"}/>{inv.confirmed?<Badge label="Confirmed ✓" type="success"/>:<Badge label="Unconfirmed" type="warning"/>}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-gray-50 rounded-xl p-2"><p className="text-xs text-gray-400">Allocated</p><p className="font-bold text-sm">{inv.ticketsAllocated}</p></div>
                  <div className="bg-emerald-50 rounded-xl p-2"><p className="text-xs text-gray-400">Sold</p><p className="font-bold text-sm text-emerald-600">{inv.ticketsSold}</p></div>
                  <div className="bg-blue-50 rounded-xl p-2"><p className="text-xs text-gray-400">Remaining</p><p className={`font-bold text-sm ${inv.ticketsRemaining===0?"text-red-600":"text-blue-600"}`}>{inv.ticketsRemaining}</p></div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-emerald-600">Cash: {fmt.currency(inv.cashCollected)}</span>
                  {!isClosed&&inv.status==="Active"&&inv.confirmed&&<button onClick={()=>setModal({type:"closeout",inv})} className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100">Close Out Rep</button>}
                </div>
              </div>
            );
          })}
          {inventory.length===0&&!il&&<EmptyState icon="🎟️" title="No reps allocated" message="Allocate tickets to get started"/>}
          {!isClosed&&<button onClick={async()=>{if(!window.confirm("Close out ALL reps for this event?"))return;setSaving("all");try{for(const inv of inventory.filter(i=>i.status==="Active"&&i.confirmed)){await inventoryDB.closeOutRep(inv.id);}show("All reps closed out!");reloadInv();reloadCE();}catch(e){show("Error: "+e.message);}setSaving(null);}} className="w-full py-3 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 mt-2" disabled={saving==="all"}>{saving==="all"?<Spinner size="sm"/>:"🔒 Close Out All Reps"}</button>}
        </div>
      )}

      {tab==="sales"&&(
        <div className="space-y-3">
          {weeklyData().map(w=>(
            <div key={w.week} className="bg-white rounded-xl border border-gray-100 p-3"><div className="flex justify-between items-center mb-2"><p className="font-bold text-sm" style={{color:NAVY}}>{w.week}</p><span className="font-bold text-emerald-600">{fmt.currency(w.revenue)}</span></div><div className="grid grid-cols-2 gap-2 text-center"><div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-400">Sales</p><p className="font-bold text-sm">{w.sales}</p></div><div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-400">Tickets</p><p className="font-bold text-sm">{w.tickets}</p></div></div></div>
          ))}
          {sales.slice(0,20).map((s,i)=>(
            <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
              <div className="flex-1"><p className="text-sm font-semibold">{s.repName}</p><p className="text-xs text-gray-400">{fmt.dateTime(s.dateSold)}</p></div>
              <div className="text-right"><p className="font-bold text-sm text-emerald-600">{fmt.currency(s.totalValue)}</p><p className="text-xs text-gray-400">{s.quantitySold} tix</p></div>
            </div>
          ))}
          {sales.length===0&&<EmptyState icon="💰" title="No sales yet" message="Sales will appear here"/>}
        </div>
      )}

      {tab==="returns"&&(
        <div className="space-y-3">
          {returnInv.map((r,i)=>(
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex justify-between items-center">
                <div><p className="font-semibold text-sm">{r.repName}</p><p className="text-xs text-gray-400">Returned: {fmt.dateTime(r.returnedAt)}</p></div>
                <div className="text-right"><p className="font-bold text-amber-600">{r.ticketsReturned} tickets</p>{r.reassignedToRepId&&<p className="text-xs text-emerald-600">→ Reassigned</p>}</div>
              </div>
              {!isClosed&&!r.reassignedToRepId&&<button onClick={()=>setModal({type:"reassign",return:r})} className="w-full mt-2 py-2 text-xs font-semibold rounded-lg" style={{background:GOLD,color:'#1B3A6B'}}>Reassign to Another Rep</button>}
            </div>
          ))}
          {returnInv.length===0&&<EmptyState icon="🔄" title="No returned tickets" message="Returned tickets appear here after reps are closed out"/>}
        </div>
      )}

      {tab==="cepoints"&&(
        <div className="space-y-3">
          {cePoints.map(p=>(
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex justify-between items-center mb-1">
                <div><p className="font-semibold text-sm">{p.repName}</p><p className="text-xs text-gray-400">CE ID: {p.ceId||"—"}</p></div>
                <CEBadge status={p.status}/>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-yellow-600">⭐ {fmt.number(p.pointsEarned)} pts ({p.ticketsSold} tix)</span>
                {p.status==="Due"&&<button onClick={async()=>{await cePointsDB.markPaid(p.id,coordName);show(`Points sent to ${p.repName}`);reloadCE();}} className="px-3 py-1.5 text-xs font-semibold rounded-lg text-gray-900" style={{background:GOLD}}>⭐ Send Points</button>}
              </div>
            </div>
          ))}
          {cePoints.length===0&&<EmptyState icon="⭐" title="No CE points records" message="Records appear after reps start selling"/>}
        </div>
      )}

      {tab==="reconciliation"&&(
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="font-bold text-gray-900 mb-3">Event Summary</p>
            <div className="space-y-2">
              {[["Gross Revenue",fmt.currency(sales.reduce((s,x)=>s+x.totalValue,0))],["Campus Tix Cut",fmt.currency(sales.reduce((s,x)=>s+x.totalValue,0)*event.commissionRate)],["Promoter Amount",fmt.currency(event.amountPaidToPromoter||0)],["Total Tickets Sold",sales.reduce((s,x)=>s+x.quantitySold,0)],["Total Tickets Returned",returnInv.reduce((s,r)=>s+r.ticketsReturned,0)]].map(([l,v])=><div key={l} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0"><span className="text-sm text-gray-500">{l}</span><span className="text-sm font-bold">{v}</span></div>)}
            </div>
          </div>
          <p className="text-sm font-bold text-gray-700">Per Rep Breakdown</p>
          {inventory.map(inv=>{
            const ce=cePoints.find(p=>p.repId===inv.repId);
            return(
              <div key={inv.id} className="bg-white rounded-xl border border-gray-100 p-3">
                <p className="font-semibold text-sm mb-2">{inv.repName}</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {[["Allocated",inv.ticketsAllocated],["Sold",inv.ticketsSold],["Returned",inv.ticketsReturned],["Cash Collected",fmt.currency(inv.cashCollected)],["CE Points",`${ce?.pointsEarned||0} pts`],["CE Status",ce?.status||"—"]].map(([l,v])=><div key={l} className="flex justify-between py-1"><span className="text-gray-400">{l}</span><span className="font-semibold">{v}</span></div>)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={modal==="allocate"} onClose={()=>setModal(null)} title="Allocate Tickets to Rep" size="sm">
        <div className="space-y-4">
          <FF label="Rep" required><select className={iCls} value={allocForm.repId} onChange={e=>{const r=allReps.find(x=>x.id===e.target.value);setAllocForm(f=>({...f,repId:e.target.value,repName:r?.name,repRepId:r?.repId,repCeId:r?.ceId}));}}><option value="">Select rep...</option>{allReps.filter(r=>r.status==="Active").map(r=><option key={r.id} value={r.id}>{r.name} ({r.repId})</option>)}</select></FF>
          <FF label="Tickets to Allocate" required><input className={iCls} type="number" min="1" value={allocForm.qty} onChange={e=>setAllocForm(f=>({...f,qty:e.target.value}))} placeholder="0"/></FF>
          <div className="flex gap-3"><button onClick={()=>setModal(null)} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">Cancel</button><PBtn className="flex-1" loading={saving==="alloc"} onClick={async()=>{if(!allocForm.repId||!allocForm.qty){show("Fill all fields");return;}setSaving("alloc");try{await inventoryDB.create({repId:allocForm.repRepId,repName:allocForm.repName,eventId:event.id,eventName:event.name,ticketsAllocated:Number(allocForm.qty)});await cePointsDB.getOrCreate(allocForm.repRepId,allocForm.repName,event.id,event.name,event.pointsPerTicket,allocForm.repCeId||"");show("Tickets allocated!");setModal(null);setAllocForm({repId:"",qty:""});reloadInv();reloadCE();}catch(e){show("Error: "+e.message);}setSaving(null);}}>Allocate</PBtn></div>
        </div>
      </Modal>

      <Modal isOpen={modal?.type==="closeout"} onClose={()=>setModal(null)} title={`Close Out: ${modal?.inv?.repName}`} size="sm">
        {modal?.inv&&<div className="space-y-4"><div className="bg-amber-50 border border-amber-200 rounded-xl p-3"><p className="text-sm font-semibold text-amber-800">This will close out {modal.inv.repName}</p><p className="text-xs text-amber-600 mt-1">Remaining {modal.inv.ticketsRemaining} tickets will be recorded as returned. CE points will become Due.</p></div><div className="flex gap-3"><button onClick={()=>setModal(null)} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">Cancel</button><PBtn variant="danger" className="flex-1" loading={saving==="co"} onClick={async()=>{setSaving("co");try{await inventoryDB.closeOutRep(modal.inv.id);show("Rep closed out!");setModal(null);reloadInv();reloadCE();}catch(e){show("Error: "+e.message);}setSaving(null);}}>Close Out Rep</PBtn></div></div>}
      </Modal>

      <Modal isOpen={modal?.type==="reassign"} onClose={()=>setModal(null)} title="Reassign Returned Tickets" size="sm">
        {modal?.return&&<div className="space-y-4"><div className="bg-gray-50 rounded-xl p-3"><p className="text-sm font-semibold">{modal.return.repName}</p><p className="text-xs text-gray-500">{modal.return.ticketsReturned} tickets available to reassign</p></div><FF label="Reassign To" required><select className={iCls} value={allocForm.repId} onChange={e=>{const r=allReps.find(x=>x.id===e.target.value);setAllocForm(f=>({...f,repId:e.target.value,repName:r?.name,repRepId:r?.repId}));}}><option value="">Select rep...</option>{allReps.filter(r=>r.repId!==modal.return.repId&&r.status==="Active").map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></FF><FF label="Qty to Reassign"><input className={iCls} type="number" min="1" max={modal.return.ticketsReturned} value={allocForm.qty} onChange={e=>setAllocForm(f=>({...f,qty:e.target.value}))} placeholder="0"/></FF><div className="flex gap-3"><button onClick={()=>setModal(null)} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">Cancel</button><PBtn className="flex-1" loading={saving==="ra"} onClick={async()=>{if(!allocForm.repId||!allocForm.qty){show("Fill all fields");return;}setSaving("ra");try{await inventoryDB.reassign(modal.return.repId,allocForm.repRepId,allocForm.repName,event.id,Number(allocForm.qty));show("Tickets reassigned!");setModal(null);setAllocForm({repId:"",qty:""});reloadInv();reloadReturn();}catch(e){show("Error: "+e.message);}setSaving(null);}}>Reassign</PBtn></div></div>}
      </Modal>
      {/* Suggest Rep Modal */}
      <Modal isOpen={modal==="suggest-rep"} onClose={()=>setModal(null)} title="Suggest New Sales Rep" size="md">
        <SuggestRepForm coordName={coordName} coordId={coordId} onClose={()=>setModal(null)} onShow={show}/>
      </Modal>

      <Toast message={toast.message} visible={toast.visible}/>
    </div>
  );
}

// ─── SUGGEST REP FORM ────────────────────────────────────────
function SuggestRepForm({coordName,coordId,onClose,onShow}){
  const[form,setForm]=useState({name:"",phone:"",email:"",university:"UWI Mona",residentCommuter:"Commuter",address:"",ceId:""});
  const[saving,setSaving]=useState(false);
  const[errors,setErrors]=useState({});
  const validate=()=>{const e={};if(!form.name.trim())e.name="Required";if(!form.email.trim())e.email="Required";setErrors(e);return!Object.keys(e).length;};
  const submit=async ev=>{
    ev.preventDefault();if(!validate())return;
    setSaving(true);
    try{
      // Generate a temp rep ID
      const tempId="PENDING-"+Date.now().toString().slice(-6);
      await repsDB.create({
        repId:tempId,
        name:form.name,
        phone:form.phone,
        email:form.email,
        university:form.university,
        residentCommuter:form.residentCommuter,
        address:form.address,
        ceId:form.ceId,
        password:"pending123",
        status:"Pending Approval",
        mustChangePassword:true,
      });
      onShow("Rep submitted for admin approval!");
      onClose();
    }catch(e){onShow("Error: "+e.message);}
    setSaving(false);
  };
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return(
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
        ⚠️ This rep will be submitted for admin approval before they can log in.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FF label="Full Name" required error={errors.name}><input className={iCls} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Full name"/></FF>
        <FF label="Phone"><input className={iCls} type="tel" value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="+1 876-555-0000"/></FF>
      </div>
      <FF label="Email" required error={errors.email}><input className={iCls} type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="email@example.com"/></FF>
      <FF label="University"><select className={iCls} value={form.university} onChange={e=>set("university",e.target.value)}>{UNIVERSITIES.map(u=><option key={u}>{u}</option>)}</select></FF>
      <div className="grid grid-cols-2 gap-3">
        <FF label="Resident / Commuter"><select className={iCls} value={form.residentCommuter} onChange={e=>set("residentCommuter",e.target.value)}><option>Commuter</option><option>Resident</option></select></FF>
        <FF label="Campus Elite ID"><input className={iCls} value={form.ceId} onChange={e=>set("ceId",e.target.value)} placeholder="CE-XXXXX"/></FF>
      </div>
      <FF label="Address"><input className={iCls} value={form.address} onChange={e=>set("address",e.target.value)} placeholder="Full address"/></FF>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700">Cancel</button>
        <PBtn className="flex-1" loading={saving}>Submit for Approval</PBtn>
      </div>
    </form>
  );
}

// ─── REP DASHBOARD ────────────────────────────────────────────
function RepDashboard(){
  const{user,logout}=useAuth();
  const[screen,setScreen]=useState("home");
  const[salesKey,setSalesKey]=useState(0);
  const{data:repInfo}=useAsync(()=>repsDB.getById(user.id),[user.id]);
  const{data:myInventory=[],reload:reloadInv}=useAsync(()=>inventoryDB.getByRep(user.repId),[user.repId,salesKey]);
  const{data:cePoints=[],reload:reloadCE}=useAsync(()=>cePointsDB.getByRep(user.repId),[user.repId,salesKey]);
  const duePoints=cePoints.filter(p=>p.status==="Due").reduce((s,p)=>s+p.pointsEarned,0);
  const pendingInv=myInventory.filter(i=>!i.confirmed&&i.status==="Active");
  if(user.mustChangePassword)return <ChangePasswordScreen dbId={user.id} userType="rep" onDone={()=>window.location.reload()}/>;
  return(
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {screen!=="home"&&<button onClick={()=>setScreen("home")} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-700">←</button>}
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{background:GOLD}}>🎟️</div>
          <div><p className="text-sm font-bold" style={{color:NAVY}}>{screen==="home"?`Hi, ${user.name.split(" ")[0]}! 👋`:{log:"Log a Sale","my-sales":"My Sales","my-inventory":"My Inventory","ce-points":"CE Points","change-password":"Change Password"}[screen]||screen}</p>{screen==="home"&&<p className="text-xs text-emerald-500 font-medium">● Live</p>}</div>
        </div>
        <div className="flex items-center gap-2">
          {duePoints>0&&<span className="text-xs font-bold px-2 py-1 rounded-lg text-gray-900" style={{background:GOLD}}>⭐ {fmt.number(duePoints)} pts due</span>}
          {pendingInv.length>0&&<span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-lg">📦 {pendingInv.length} to confirm</span>}
          <button onClick={logout} className="flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg" style={{background:NAVY}}>🚪</button>
        </div>
      </header>
      <main className="px-4 py-5 max-w-lg mx-auto">
        {screen==="home"&&(
          <div className="space-y-4">
            {duePoints>0&&<div className="p-4 rounded-2xl text-gray-900" style={{background:GOLD}}><p className="text-xs font-bold opacity-75 mb-1">⭐ CE Points Due</p><p className="text-2xl font-black">{fmt.number(duePoints)} pts</p><p className="text-xs opacity-75 mt-1">Contact your coordinator for payout</p></div>}
            <button onClick={()=>setScreen("log")} className="w-full py-5 rounded-2xl font-bold text-xl shadow-lg flex items-center justify-center gap-3 text-white" style={{background:NAVY}}><span className="text-2xl">🎟️</span>Log a Sale</button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={()=>setScreen("my-sales")} className="w-full py-5 bg-white border-2 border-gray-100 hover:border-gray-200 rounded-2xl font-bold text-gray-800 shadow-sm flex flex-col items-center gap-2"><span className="text-3xl">📋</span><span className="text-sm">My Sales</span></button>
              <button onClick={()=>setScreen("my-inventory")} className={`w-full py-5 border-2 rounded-2xl font-bold shadow-sm flex flex-col items-center gap-2 ${pendingInv.length>0?"border-amber-300 bg-amber-50 text-amber-800":"border-gray-100 bg-white text-gray-800"}`}><span className="text-3xl">📦</span><span className="text-sm">My Inventory</span>{pendingInv.length>0&&<span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-lg">{pendingInv.length} to confirm</span>}</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={()=>setScreen("ce-points")} className="w-full py-5 bg-white border-2 border-gray-100 hover:border-gray-200 rounded-2xl font-bold text-gray-800 shadow-sm flex flex-col items-center gap-2"><span className="text-3xl">⭐</span><span className="text-sm">CE Points</span></button>
              <button onClick={()=>setScreen("change-password")} className="w-full py-5 bg-white border-2 border-gray-100 hover:border-gray-200 rounded-2xl font-bold text-gray-800 shadow-sm flex flex-col items-center gap-2"><span className="text-3xl">🔑</span><span className="text-sm">Password</span></button>
            </div>
            <button onClick={logout} className="w-full py-4 border-2 border-gray-200 hover:border-red-200 hover:bg-red-50 rounded-2xl font-semibold text-gray-600 hover:text-red-600 transition-all flex items-center justify-center gap-2">🚪 Sign Out</button>
          </div>
        )}
        {screen==="log"&&<RepLogSale key={salesKey} repInfo={repInfo||user} onSuccess={()=>{setSalesKey(k=>k+1);reloadInv();reloadCE();}}/>}
        {screen==="my-sales"&&<RepMySales key={salesKey} repId={user.repId}/>}
        {screen==="my-inventory"&&<RepMyInventory key={salesKey} repId={user.repId} onRefresh={()=>{setSalesKey(k=>k+1);}}/>}
        {screen==="ce-points"&&<RepCEPoints key={salesKey} repId={user.repId} ceId={user.ceId}/>}
        {screen==="change-password"&&<RepChangePassword repId={user.id} onDone={()=>setScreen("home")}/>}
      </main>
    </div>
  );
}

function RepLogSale({repInfo,onSuccess}){
  const{data:activeInv=[],loading:il}=useAsync(()=>inventoryDB.getActiveForRep(repInfo?.repId||repInfo?.rep_id||""),[repInfo?.repId]);
  const{data:events=[]}=useAsync(()=>eventsDB.getAll());
  const[form,setForm]=useState({invId:"",qty:1,paymentMethod:"Cash",customerName:"",customerPhone:"",customerEmail:""});
  const[loading,setLoading]=useState(false);const[error,setError]=useState("");const[confirmation,setConfirmation]=useState(null);
  const selectedInv=activeInv.find(i=>i.id===form.invId);
  const selectedEvent=events.find(e=>e.id===selectedInv?.eventId);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const submit=async e=>{
    e.preventDefault();setError("");
    if(!form.invId){setError("Select an event");return;}
    if(!form.qty||Number(form.qty)<=0){setError("Enter valid quantity");return;}
    if(selectedInv&&Number(form.qty)>selectedInv.ticketsRemaining){setError(`Only ${selectedInv.ticketsRemaining} tickets remaining`);return;}
    setLoading(true);
    try{
      const total=Number(form.qty)*(selectedEvent?.ticketPrice||0);
      const pointsEarned=Number(form.qty)*(selectedEvent?.pointsPerTicket||10);
      await salesDB.create({repId:repInfo.repId,repName:repInfo.name,eventId:selectedInv.eventId,eventName:selectedInv.eventName,quantitySold:Number(form.qty),ticketPrice:selectedEvent?.ticketPrice||0,totalValue:total,paymentMethod:form.paymentMethod,inventoryId:form.invId,pointsPerTicket:selectedEvent?.pointsPerTicket||10,ceId:repInfo.ceId});
      setConfirmation({qty:Number(form.qty),total,pointsEarned,remaining:selectedInv.ticketsRemaining-Number(form.qty),eventName:selectedInv.eventName});
      onSuccess();
    }catch(e){setError("Error: "+e.message);}
    setLoading(false);
  };
  if(confirmation)return(
    <div className="text-center py-8">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-xl text-4xl" style={{background:GOLD}}>✓</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Sale Logged!</h2>
      <p className="text-gray-500 text-sm mb-6">Saved instantly</p>
      <div className="bg-gray-50 rounded-2xl p-5 text-left mb-6 space-y-3">
        <div className="flex justify-between"><span className="text-sm text-gray-500">Event</span><span className="text-sm font-semibold">{confirmation.eventName}</span></div>
        <div className="flex justify-between"><span className="text-sm text-gray-500">Tickets Sold</span><span className="text-sm font-semibold">{confirmation.qty}</span></div>
        <div className="flex justify-between"><span className="text-sm text-gray-500">Total Collected</span><span className="text-lg font-bold text-emerald-600">{fmt.currency(confirmation.total)}</span></div>
        <div className="flex justify-between border-t border-gray-200 pt-3"><span className="text-sm font-semibold text-gray-600">CE Points Earned</span><span className="text-base font-bold text-yellow-600">⭐ {fmt.number(confirmation.pointsEarned)} pts</span></div>
        <div className="flex justify-between"><span className="text-sm text-gray-500">Tickets Remaining</span><span className={`text-sm font-bold ${confirmation.remaining===0?"text-red-600":"text-gray-800"}`}>{confirmation.remaining===0?"⚠️ SOLD OUT!":confirmation.remaining}</span></div>
      </div>
      <button onClick={()=>{setConfirmation(null);setForm({invId:"",qty:1,paymentMethod:"Cash",customerName:"",customerPhone:"",customerEmail:""});}} className="w-full py-4 font-bold rounded-2xl text-lg text-white" style={{background:NAVY}}>Log Another Sale</button>
    </div>
  );
  return(
    <form onSubmit={submit} className="space-y-4">
      <div className="p-4 rounded-2xl text-white" style={{background:NAVY}}><p className="text-xs font-semibold opacity-75">Logging as</p><p className="text-lg font-bold">{repInfo?.name}</p><p className="text-xs opacity-75">{repInfo?.repId}</p></div>
      {error&&<div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">⚠️ {error}</div>}
      <FF label="Select Event" required>
        {il?<div className="h-12 bg-gray-50 rounded-xl animate-pulse"/>:(
          <select className={iCls} value={form.invId} onChange={e=>set("invId",e.target.value)}>
            <option value="">Choose event...</option>
            {activeInv.map(i=><option key={i.id} value={i.id}>{i.eventName} ({i.ticketsRemaining} remaining)</option>)}
          </select>
        )}
      </FF>
      {selectedInv&&<div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3"><div className="flex justify-between items-center"><span className="text-xs font-semibold text-yellow-700">Tickets Remaining</span><span className="font-bold text-yellow-800">{selectedInv.ticketsRemaining}</span></div>{selectedEvent&&<div className="flex justify-between items-center mt-1"><span className="text-xs font-semibold text-yellow-700">Price per ticket</span><span className="font-bold text-yellow-800">{fmt.currency(selectedEvent.ticketPrice)}</span></div>}</div>}
      <FF label="Quantity" required>
        <div className="flex items-center gap-3">
          <button type="button" onClick={()=>set("qty",Math.max(1,Number(form.qty)-1))} className="w-12 h-12 bg-gray-100 rounded-xl text-xl font-bold text-gray-700 flex items-center justify-center">−</button>
          <input className={iCls+" text-center text-lg font-bold"} type="number" min="1" max={selectedInv?.ticketsRemaining||999} value={form.qty} onChange={e=>set("qty",e.target.value)}/>
          <button type="button" onClick={()=>set("qty",Number(form.qty)+1)} className="w-12 h-12 bg-gray-100 rounded-xl text-xl font-bold text-gray-700 flex items-center justify-center">+</button>
        </div>
      </FF>
      {selectedEvent&&form.qty>0&&<div className="bg-gray-50 rounded-xl p-3 flex justify-between"><span className="text-sm text-gray-500">Total</span><span className="font-bold text-emerald-600">{fmt.currency(Number(form.qty)*selectedEvent.ticketPrice)}</span></div>}
      <FF label="Payment Method" required>
        <div className="grid grid-cols-2 gap-2">{PAYMENT_METHODS.map(m=><button key={m} type="button" onClick={()=>set("paymentMethod",m)} className={`py-3 px-4 rounded-xl text-sm font-semibold border-2 transition-all ${form.paymentMethod===m?"border-blue-500 text-white":"border-gray-200 bg-white text-gray-700"}`} style={form.paymentMethod===m?{background:NAVY}:{}}>{m==="Cash"?"💵":m==="Card"?"💳":m==="Bank Transfer"?"🏦":"📱"} {m}</button>)}</div>
      </FF>
      <FF label="Customer Name" hint="Optional"><input className={iCls} value={form.customerName} onChange={e=>set("customerName",e.target.value)} placeholder="Customer name"/></FF>
      <FF label="Customer Phone" hint="Optional"><input className={iCls} type="tel" value={form.customerPhone} onChange={e=>set("customerPhone",e.target.value)} placeholder="+1 876-555-0000"/></FF>
      <PBtn className="w-full py-4 text-base mt-2" loading={loading} disabled={activeInv.length===0} onClick={submit}>🎟️ Submit Sale</PBtn>
      {activeInv.length===0&&!il&&<p className="text-center text-xs text-gray-500">No active inventory. Contact your coordinator.</p>}
    </form>
  );
}

function RepMySales({repId}){
  const{data:sales=[],loading}=useAsync(()=>salesDB.getByRep(repId));
  const totalRev=sales.reduce((s,x)=>s+x.totalValue,0);
  const totalPts=sales.reduce((s,x)=>s+x.quantitySold,0)*10;
  return(
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Total Revenue" value={fmt.currency(totalRev)} icon="💰" color={NAVY} loading={loading}/>
        <StatCard title="Tickets Sold" value={sales.reduce((s,x)=>s+x.quantitySold,0)} icon="🎟️" color={PURPLE} loading={loading}/>
      </div>
      {loading?<div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 bg-white rounded-2xl border border-gray-100 animate-pulse"/>)}</div>:
        sales.length===0?<EmptyState icon="🎟️" title="No sales yet" message="Log your first sale to see it here"/>:(
          <div className="space-y-3">{sales.map(s=>(
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-1"><div><p className="font-bold text-gray-900 text-sm">{s.eventName}</p><p className="text-xs text-gray-400">{fmt.dateTime(s.dateSold)} · Wk {s.weekNumber}</p></div><span className="font-bold text-emerald-600">{fmt.currency(s.totalValue)}</span></div>
              <div className="flex items-center justify-between text-xs text-gray-500"><span>🎟️ {s.quantitySold} tickets · {s.paymentMethod}</span><span className="font-semibold text-yellow-600">⭐ {s.quantitySold*10} pts</span></div>
            </div>
          ))}</div>
        )
      }
    </div>
  );
}

function RepMyInventory({repId,onRefresh}){
  const{data:inventory=[],loading,reload}=useAsync(()=>inventoryDB.getByRep(repId),[repId]);
  const{toast,show}=useToast();const[saving,setSaving]=useState(null);
  const unconfirmed=inventory.filter(i=>!i.confirmed&&i.status==="Active");
  const confirmed=inventory.filter(i=>i.confirmed);
  return(
    <div className="space-y-4">
      {unconfirmed.length>0&&(
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3"><p className="text-sm font-bold text-amber-800">📦 {unconfirmed.length} ticket allocation{unconfirmed.length>1?"s":""} to confirm</p></div>
          {unconfirmed.map(inv=>(
            <div key={inv.id} className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm mb-3">
              <div className="flex items-start justify-between mb-3"><div><p className="font-bold text-gray-900">{inv.eventName}</p><p className="text-xs text-gray-400">Allocated: <strong>{inv.ticketsAllocated}</strong> tickets</p></div><Badge label="Pending" type="warning"/></div>
              <PBtn variant="green" className="w-full" loading={saving===inv.id} onClick={async()=>{setSaving(inv.id);try{await inventoryDB.confirm(inv.id);show("Tickets confirmed!");reload();if(onRefresh)onRefresh();}catch(e){show("Error: "+e.message);}setSaving(null);}}>✅ Confirm Receipt of {inv.ticketsAllocated} tickets</PBtn>
            </div>
          ))}
        </div>
      )}
      {confirmed.map(inv=>(
        <div key={inv.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-start justify-between mb-2"><p className="font-bold text-gray-900">{inv.eventName}</p><Badge label={inv.status} type={inv.status==="Active"?"success":"danger"}/></div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-xl p-2"><p className="text-xs text-gray-400">Allocated</p><p className="text-sm font-bold">{inv.ticketsAllocated}</p></div>
            <div className="bg-emerald-50 rounded-xl p-2"><p className="text-xs text-gray-400">Sold</p><p className="text-sm font-bold text-emerald-600">{inv.ticketsSold}</p></div>
            <div className={`rounded-xl p-2 ${inv.ticketsRemaining===0?"bg-red-50":"bg-blue-50"}`}><p className="text-xs text-gray-400">Remaining</p><p className={`text-sm font-bold ${inv.ticketsRemaining===0?"text-red-600":"text-blue-600"}`}>{inv.ticketsRemaining}</p></div>
          </div>
          <div className="mt-2 flex justify-between text-sm"><span className="text-gray-500">Cash Collected</span><span className="font-bold text-emerald-600">{fmt.currency(inv.cashCollected)}</span></div>
          {inv.status==="Closed"&&<div className="mt-2 text-center text-xs text-gray-400 bg-gray-50 rounded-lg p-2">🔒 Closed out — {inv.ticketsReturned} tickets returned</div>}
        </div>
      ))}
      {inventory.length===0&&!loading&&<EmptyState icon="📦" title="No ticket inventory" message="Your coordinator will allocate tickets to you"/>}
      <Toast message={toast.message} visible={toast.visible}/>
    </div>
  );
}

function RepCEPoints({repId,ceId}){
  const{data:points=[],loading}=useAsync(()=>cePointsDB.getByRep(repId));
  const totalPts=points.reduce((s,p)=>s+p.pointsEarned,0);
  const duePts=points.filter(p=>p.status==="Due").reduce((s,p)=>s+p.pointsEarned,0);
  return(
    <div className="space-y-4">
      <div className="p-5 rounded-2xl text-gray-900 text-center" style={{background:GOLD}}>
        <p className="text-xs font-bold opacity-75">My CE ID</p>
        <p className="font-mono font-bold text-lg">{ceId||"Not set — contact admin"}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Total Points" value={fmt.number(totalPts)+" pts"} icon="⭐" color={PURPLE} loading={loading}/>
        <StatCard title="Points Due" value={fmt.number(duePts)+" pts"} icon="🔴" color="#dc2626" loading={loading}/>
      </div>
      {loading?<div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 bg-white rounded-2xl border border-gray-100 animate-pulse"/>)}</div>:
        points.length===0?<EmptyState icon="⭐" title="No CE points yet" message="Points accumulate as you sell tickets"/>:(
          <div className="space-y-3">{points.map(p=>(
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-1"><p className="font-bold text-gray-900 text-sm">{p.eventName}</p><CEBadge status={p.status}/></div>
              <div className="flex items-center justify-between text-sm"><span className="text-gray-500">{p.ticketsSold} tickets × {p.pointsPerTicket} pts</span><span className="font-bold text-yellow-600">⭐ {fmt.number(p.pointsEarned)} pts</span></div>
              {p.paidAt&&<p className="text-xs text-gray-400 mt-1">Sent {fmt.date(p.paidAt)} by {p.paidBy}</p>}
            </div>
          ))}</div>
        )
      }
    </div>
  );
}

function RepChangePassword({repId,onDone}){
  const[form,setForm]=useState({current:"",newPw:"",confirmPw:""});
  const[error,setError]=useState("");const[loading,setLoading]=useState(false);const[success,setSuccess]=useState(false);
  const submit=async e=>{
    e.preventDefault();setError("");
    if(form.newPw.length<6){setError("Must be at least 6 characters");return;}
    if(form.newPw!==form.confirmPw){setError("Passwords do not match");return;}
    setLoading(true);
    try{const rep=await repsDB.getById(repId);if(rep.password!==form.current){setError("Current password incorrect");setLoading(false);return;}await repsDB.changePassword(repId,form.newPw);setSuccess(true);setTimeout(onDone,2000);}
    catch(e){setError(e.message);}
    setLoading(false);
  };
  if(success)return <div className="text-center py-8"><div className="text-5xl mb-4">✅</div><p className="font-bold text-gray-900">Password Changed!</p></div>;
  return(
    <form onSubmit={submit} className="space-y-4">
      <FF label="Current Password" required><input className={iCls} type="password" value={form.current} onChange={e=>setForm(f=>({...f,current:e.target.value}))} placeholder="Current password"/></FF>
      <FF label="New Password" required><input className={iCls} type="password" value={form.newPw} onChange={e=>setForm(f=>({...f,newPw:e.target.value}))} placeholder="At least 6 characters"/></FF>
      <FF label="Confirm New Password" required><input className={iCls} type="password" value={form.confirmPw} onChange={e=>setForm(f=>({...f,confirmPw:e.target.value}))} placeholder="Repeat new password"/></FF>
      {error&&<p className="text-sm text-red-600">⚠️ {error}</p>}
      <PBtn className="w-full" loading={loading}>🔑 Change Password</PBtn>
    </form>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────
function AppContent(){
  const{user,loading}=useAuth();
  const[adminPage,setAdminPage]=useState("dashboard");
  if(loading)return <div className="min-h-screen flex items-center justify-center" style={{background:NAVY}}><div className="text-center"><div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-2xl" style={{background:GOLD}}>🎟️</div><div className="w-8 h-8 border-4 border-blue-300 rounded-full animate-spin mx-auto" style={{borderTopColor:GOLD}}/><p className="text-blue-200 text-sm mt-4">Loading Campus Tix...</p></div></div>;
  if(!user)return <LoginScreen/>;
  if(user.type==="rep")return <RepDashboard/>;
  if(user.type==="coordinator")return <CoordinatorDashboard/>;
  const pages={
    dashboard:<AdminDashboard setPage={setAdminPage}/>,
    events:<AdminEvents/>,
    coordinators:<AdminCoordinators/>,
    reps:<AdminReps/>,
    repinventory:<AdminRepInventory/>,
    sales:<AdminSales/>,
    cepoints:<AdminCEPoints/>,
    commissions:<AdminCommissions/>,
    reports:<AdminReports/>,
    settings:<AdminSettings/>,
  };
  return <AdminLayout page={adminPage} setPage={setAdminPage}>{pages[adminPage]||pages.dashboard}</AdminLayout>;
}

export default function App(){
  return <ErrorBoundary><AuthProvider><AppContent/></AuthProvider></ErrorBoundary>;
}
