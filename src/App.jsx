import React, { useMemo, useRef, useState } from "react";
import { Activity, Archive, ClipboardList, FileText, ImagePlus, RefreshCw, ShieldCheck, Upload, Users, X } from "lucide-react";
import { supabase } from "./lib/supabase";

const seedCases = [];
const roles = ["Admin", "Sonographer", "Sonologist"];

function App() {
  const [role, setRole] = useState("Sonographer");
  const [tab, setTab] = useState("My Cases");
  const [cases, setCases] = useState(seedCases);
  const [filter, setFilter] = useState("All cases");
  const [showAdd, setShowAdd] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [labNumber, setLabNumber] = useState("");
  const [reportFiles, setReportFiles] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [notice, setNotice] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState({ fullName: "", username: "", password: "", role: "Sonographer" });
  const reportInput = useRef(null);
  const imageInput = useRef(null);

  const filteredCases = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return cases.filter(c => {
      const d = new Date(c.createdAt);
      if (role === "Sonographer" && c.createdBy !== "You") return false;
      if (role === "Sonologist" && c.status !== "Awaiting review") return false;
      if (filter === "Today only") return d >= startToday;
      if (filter === "Today + Yesterday") return d >= new Date(startToday.getTime() - 86400000);
      if (filter === "Select date range") {
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      }
      return true;
    });
  }, [cases, role, filter, dateFrom, dateTo]);

  function addCase(e) {
    e.preventDefault();
    if (!patientName.trim() || !labNumber.trim() || !reportFiles.length || !imageFiles.length) {
      setNotice("Please complete all required fields and attach at least one report/document and one ultrasound image.");
      return;
    }
    const item = {
      id: crypto.randomUUID(), patientName: patientName.trim(), labNumber: labNumber.trim(),
      status: "Awaiting review", createdAt: new Date().toISOString(), createdBy: "You",
      reportNames: reportFiles.map(f => f.name), imageNames: imageFiles.map(f => f.name)
    };
    setCases(prev => [item, ...prev]);
    setShowAdd(false); setPatientName(""); setLabNumber(""); setReportFiles([]); setImageFiles([]);
    setNotice("Case added to the review queue in this prototype. Connect Supabase to persist cases and files.");
  }

  function createAccount(e) {
    e.preventDefault();
    if (!account.fullName || !account.username || !account.password) return setNotice("Complete all account fields.");
    setAccounts(prev => [...prev, { ...account, password: "••••••••" }]);
    setAccount({ fullName: "", username: "", password: "", role: "Sonographer" });
    setNotice("Account entry added to this prototype only. Supabase Auth account provisioning is not connected yet.");
  }

  async function exportBackup() {
    const payload = { exportedAt: new Date().toISOString(), cases, accounts };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ultrasound-backup-prototype.json"; a.click();
    URL.revokeObjectURL(url);
    setNotice("Prototype JSON export downloaded. This is not yet the requested complete monthly ZIP backup.");
  }

  const nav = role === "Admin" ? ["User Accounts", "All Cases", "Archive & Storage"] :
    role === "Sonologist" ? ["Review Queue"] : ["My Cases"];

  return <div className="page">
    <header className="topbar">
      <div className="brand"><div className="brandIcon"><Activity size={20}/></div><div><strong>Ultrasound</strong><small>Online Review & Reporting</small></div></div>
      <div className="rolePicker"><label htmlFor="role">Preview role</label><select id="role" value={role} onChange={e => {setRole(e.target.value); setTab(e.target.value === "Admin" ? "User Accounts" : e.target.value === "Sonologist" ? "Review Queue" : "My Cases"); setNotice("");}}>{roles.map(r => <option key={r}>{r}</option>)}</select></div>
    </header>

    <main className="shell">
      <section className="intro"><h1>Ultrasound</h1><p>Submit cases for review and track approval status.</p>
        <nav className="tabs">{nav.map(n => <button key={n} className={tab === n ? "tab active" : "tab"} onClick={() => setTab(n)}>{n}</button>)}</nav>
      </section>

      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}

      {role === "Admin" && tab === "User Accounts" && <section className="panel">
        <h2>Create Ultrasound Account</h2><p className="muted">Create a separate login. These accounts can access only the Ultrasound department.</p>
        <form onSubmit={createAccount} className="formStack">
          <Field label="Full Name"><input value={account.fullName} onChange={e=>setAccount({...account,fullName:e.target.value})} placeholder="Full name" required/></Field>
          <Field label="Username / User ID"><input value={account.username} onChange={e=>setAccount({...account,username:e.target.value})} placeholder="e.g. sonographer1" required/></Field>
          <Field label="Password"><input type="password" minLength="6" value={account.password} onChange={e=>setAccount({...account,password:e.target.value})} placeholder="At least 6 characters" required/></Field>
          <Field label="Department Role"><select value={account.role} onChange={e=>setAccount({...account,role:e.target.value})}><option>Sonographer</option><option>Sonologist</option><option>Admin</option></select></Field>
          <button className="primary">Create Account</button>
        </form>
        <h3 className="subheading">Created in this session</h3>{accounts.length ? <div className="tableWrap"><table><thead><tr><th>Name</th><th>User ID</th><th>Role</th></tr></thead><tbody>{accounts.map((a,i)=><tr key={i}><td>{a.fullName}</td><td>{a.username}</td><td>{a.role}</td></tr>)}</tbody></table></div> : <p className="muted">No accounts created in this session.</p>}
      </section>}

      {role === "Admin" && tab === "All Cases" && <CaseList cases={cases} title="All Ultrasound Cases" refresh={()=>setNotice("List refreshed.")}/>}
      {role === "Admin" && tab === "Archive & Storage" && <section className="panel">
        <h2>Monthly Backup & Storage</h2><p className="muted">Export a backup file to your computer. Monthly ZIP archive/restore and verified deletion need backend implementation.</p>
        <Field label="Select month"><input type="month" defaultValue="2026-11"/></Field>
        <div className="buttonRow"><button className="primary" onClick={exportBackup}>Export Backup</button><label className="secondary fileButton">Import Backup<input type="file" accept=".zip,.json" onChange={()=>setNotice("Import UI selected. Secure validation and restore are not implemented yet.")}/></label></div>
        <hr/><h3>Delete Selected Month</h3><p className="muted">Deletion is intentionally disabled in this starter to protect patient records until backup/restore and authorization are implemented.</p>
        <button className="danger" disabled>Delete Selected Month (disabled)</button>
        <div className="subheading rowBetween"><h3>Online Ultrasound Storage by Month</h3><button className="secondary" onClick={()=>setNotice("Storage list refreshed.")}><RefreshCw size={14}/> Refresh</button></div>
        <p className="muted">Storage summary will appear here after Supabase Storage integration.</p>
      </section>}

      {role === "Sonographer" && <section className="panel">
        <div className="rowBetween"><div><h2>My Ultrasound Cases</h2><p className="muted">Track each case. After approval, open the case to print for patient dispatch.</p></div><div className="buttonRow"><button className="primary" onClick={()=>{setShowAdd(true);setNotice("");}}>+ Add Case</button><button className="secondary" onClick={()=>setNotice("Cases refreshed.")}><RefreshCw size={14}/> Refresh</button></div></div>
        <Field label="Show cases"><select className="filter" value={filter} onChange={e=>setFilter(e.target.value)}><option>Today + Yesterday</option><option>Today only</option><option>Select date range</option><option>All cases</option></select></Field>
        {filter === "Select date range" && <div className="dateRow"><Field label="From"><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></Field><Field label="To"><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></Field></div>}
        <CaseTable cases={filteredCases}/>
      </section>}

      {role === "Sonologist" && <section className="panel">
        <div className="rowBetween"><div><h2>Cases Awaiting Final Review</h2><p className="muted">Open the report and images, add comments if changes are needed, then approve and sign out.</p></div><button className="secondary" onClick={()=>setNotice("Review queue refreshed.")}><RefreshCw size={14}/> Refresh</button></div>
        <Field label="Show cases"><select className="filter" value={filter} onChange={e=>setFilter(e.target.value)}><option>All cases</option><option>Today only</option><option>Select date range</option></select></Field>
        <CaseTable cases={filteredCases} review/>
        <p className="hint">The detailed case review, reporting, approval and sign-out screen has not been designed yet because its screenshot/workflow has not been provided.</p>
      </section>}
      <footer>Ultrasound Online Review & Reporting <span>Starter version 0.1.0</span></footer>
    </main>

    {showAdd && <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowAdd(false);}}>
      <form className="modal" onSubmit={addCase}>
        <div className="rowBetween"><div><h2>Add Ultrasound Case</h2><p className="muted">Enter patient details and attach the report and ultrasound images.</p></div><button type="button" className="iconButton" onClick={()=>setShowAdd(false)}><X size={18}/></button></div>
        <Field label="Patient Name *"><input value={patientName} onChange={e=>setPatientName(e.target.value)} placeholder="Patient name" required/></Field>
        <Field label="Lab Number *"><input value={labNumber} onChange={e=>setLabNumber(e.target.value)} placeholder="Lab number" required/></Field>
        <Attachment label="Report / Document *" files={reportFiles} setFiles={setReportFiles} inputRef={reportInput} accept="image/*,.pdf,.doc,.docx" multiple capture="environment" help="Upload document(s) or capture a photo using a supported device camera."/>
        <Attachment label="Ultrasound Images *" files={imageFiles} setFiles={setImageFiles} inputRef={imageInput} accept="image/*" multiple capture="environment" help="Select multiple images or use the camera capture option."/>
        <div className="modalActions"><button type="button" className="secondary" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary">Save & Send for Review</button></div>
      </form>
    </div>}
  </div>;
}

function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label>; }
function Attachment({label,files,setFiles,inputRef,accept,multiple,capture,help}) {
  function add(list) { setFiles(prev => [...prev, ...Array.from(list || [])]); if(inputRef.current) inputRef.current.value=""; }
  return <div className="field"><span>{label}</span>
    <div className="attachButtons"><button type="button" className="secondary" onClick={()=>inputRef.current?.click()}><Upload size={14}/> Upload from device</button><button type="button" className="secondary" onClick={()=>{if(inputRef.current){inputRef.current.setAttribute("capture",capture);inputRef.current.click();}}}><ImagePlus size={14}/> Take Photo</button></div>
    <input ref={inputRef} className="hiddenInput" type="file" accept={accept} multiple={multiple} onChange={e=>add(e.target.files)}/>
    <p className="hint">{help}</p>
    {files.length>0 && <ul className="fileList">{files.map((f,i)=><li key={i}>{f.name}<button type="button" onClick={()=>setFiles(prev=>prev.filter((_,n)=>n!==i))}><X size={14}/></button></li>)}</ul>}
  </div>;
}
function CaseTable({cases,review=false}) {
  if (!cases.length) return <p className="empty">No ultrasound cases found for this selection.</p>;
  return <div className="tableWrap"><table><thead><tr><th>Patient</th><th>Lab Number</th><th>Date</th><th>Status</th>{review&&<th>Submitted By</th>}</tr></thead><tbody>{cases.map(c=><tr key={c.id}><td>{c.patientName}</td><td>{c.labNumber}</td><td>{new Date(c.createdAt).toLocaleString()}</td><td><span className="status">{c.status}</span></td>{review&&<td>{c.createdBy}</td>}</tr>)}</tbody></table></div>;
}
function CaseList({cases,title,refresh}) { return <section className="panel"><div className="rowBetween"><h2>{title}</h2><button className="secondary" onClick={refresh}><RefreshCw size={14}/> Refresh</button></div><CaseTable cases={cases}/></section>; }

export default App;