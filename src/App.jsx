import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, RefreshCw, Upload, Camera, X, Eye, FileText, Image as ImageIcon, CheckCircle2, MessageSquare, AlertTriangle, LoaderCircle } from "lucide-react";
import { supabase } from "./lib/supabase";

const BUCKET = "ultrasound-files";
const roles = ["Admin", "Sonographer", "Sonologist"];
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function App() {
  const [role, setRole] = useState("Sonographer");
  const [tab, setTab] = useState("My Cases");
  const [cases, setCases] = useState([]);
  const [filter, setFilter] = useState("All cases");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [patientName, setPatientName] = useState("");
  const [labNumber, setLabNumber] = useState("");
  const [reportFiles, setReportFiles] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("info");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [signedFiles, setSignedFiles] = useState({ reports: [], images: [] });
  const [busyAction, setBusyAction] = useState(false);
  const reportUploadRef = useRef(null);
  const reportCameraRef = useRef(null);
  const imageUploadRef = useRef(null);
  const imageCameraRef = useRef(null);

  const configured = Boolean(supabase);

  const notify = useCallback((message, type = "info") => {
    setNotice(message);
    setNoticeType(type);
  }, []);

  const loadCases = useCallback(async () => {
    if (!supabase) {
      setCases([]);
      notify("Supabase connection is not configured. Check the Netlify environment variables and redeploy.", "error");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("ultrasound_cases")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      notify(`Could not load cases: ${error.message}. Run the updated supabase/schema.sql in Supabase SQL Editor.`, "error");
      return;
    }
    setCases(data || []);
  }, [notify]);

  useEffect(() => { loadCases(); }, [loadCases]);

  const nav = role === "Admin" ? ["User Accounts", "All Cases", "Archive & Storage"] : role === "Sonologist" ? ["Review Queue"] : ["My Cases"];
  const filteredCases = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return cases.filter((item) => {
      const created = new Date(item.created_at);
      if (role === "Sonologist" && item.status !== "awaiting_review" && item.status !== "in_review" && item.status !== "changes_requested") return false;
      if (role === "Sonographer" && item.submitted_role !== "sonographer") return false;
      if (filter === "Today only" && created < startToday) return false;
      if (filter === "Today + Yesterday" && created < new Date(startToday.getTime() - 86400000)) return false;
      if (filter === "Select date range") {
        if (dateFrom && created < new Date(`${dateFrom}T00:00:00`)) return false;
        if (dateTo && created > new Date(`${dateTo}T23:59:59`)) return false;
      }
      return true;
    });
  }, [cases, role, filter, dateFrom, dateTo]);

  function validateFiles(files, label) {
    if (!files.length) return `${label}: please select at least one file.`;
    const allowed = /\.(pdf|jpg|jpeg|png|webp|doc|docx)$/i;
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 50 MB. Please choose a smaller file.`;
      if (!allowed.test(file.name)) return `${file.name} has an unsupported format. Use PDF, JPG, PNG, WEBP, DOC or DOCX.`;
    }
    return "";
  }

  async function uploadFiles(caseId, files, folder) {
    const paths = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${caseId}/${folder}/${crypto.randomUUID()}-${safeName}`;
      const extension = file.name.split(".").pop()?.toLowerCase();
      const inferredType = ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })[extension] || file.type;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: inferredType || "application/octet-stream"
      });
      if (error) throw new Error(`Upload failed for ${file.name}: ${error.message}`);
      paths.push({ path, name: file.name, size: file.size, type: file.type || "application/octet-stream" });
    }
    return paths;
  }

  async function addCase(event) {
    event.preventDefault();
    if (!supabase) return notify("Supabase is not configured. Please check Netlify environment variables.", "error");
    if (!patientName.trim() || !labNumber.trim()) return notify("Patient Name and Lab Number are required.", "error");
    const reportError = validateFiles(reportFiles, "Report / Document");
    const imageError = validateFiles(imageFiles, "Ultrasound Images");
    if (reportError || imageError) return notify(reportError || imageError, "error");

    setSaving(true);
    let uploadedReportPaths = [];
    let uploadedImagePaths = [];
    const caseId = crypto.randomUUID();
    try {
      notify("Uploading report/document files…", "info");
      uploadedReportPaths = await uploadFiles(caseId, reportFiles, "reports");
      notify("Uploading ultrasound images…", "info");
      uploadedImagePaths = await uploadFiles(caseId, imageFiles, "images");
      notify("Saving case details…", "info");
      const payload = {
        id: caseId,
        patient_name: patientName.trim(),
        lab_number: labNumber.trim(),
        submitted_by: "Sonographer (test mode)",
        submitted_role: "sonographer",
        status: "awaiting_review",
        report_files: uploadedReportPaths,
        ultrasound_files: uploadedImagePaths
      };
      const { error } = await supabase.from("ultrasound_cases").insert(payload);
      if (error) throw new Error(`Case save failed: ${error.message}`);
      setShowAdd(false);
      setPatientName(""); setLabNumber(""); setReportFiles([]); setImageFiles([]);
      notify("Case and attachments saved successfully. The case is now in the Sonologist review queue.", "success");
      await loadCases();
    } catch (error) {
      const cleanup = [...uploadedReportPaths, ...uploadedImagePaths].map((f) => f.path);
      if (cleanup.length && supabase) await supabase.storage.from(BUCKET).remove(cleanup);
      notify(error.message || "Unable to save case. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function openCase(item) {
    setSelectedCase(item);
    setReviewComment(item.review_comment || "");
    setSignedFiles({ reports: [], images: [] });
    if (!supabase) return;
    const makeLinks = async (files = []) => Promise.all((files || []).map(async (file) => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.path, 3600);
      return { ...file, url: error ? null : data?.signedUrl, error: error?.message };
    }));
    const [reports, images] = await Promise.all([
      makeLinks(item.report_files), makeLinks(item.ultrasound_files)
    ]);
    setSignedFiles({ reports, images });
  }

  async function updateCaseStatus(status) {
    if (!selectedCase || !supabase) return;
    setBusyAction(true);
    const { error } = await supabase.from("ultrasound_cases").update({
      status,
      review_comment: reviewComment.trim() || null,
      reviewed_at: new Date().toISOString()
    }).eq("id", selectedCase.id);
    setBusyAction(false);
    if (error) return notify(`Could not update case: ${error.message}`, "error");
    setSelectedCase(null);
    notify(status === "approved" ? "Case approved." : "Changes requested. The case remains available for follow-up.", "success");
    await loadCases();
  }

  async function refresh() { await loadCases(); }

  async function exportBackup() {
    if (!supabase) return notify("Supabase is not connected.", "error");
    const { data, error } = await supabase.from("ultrasound_cases").select("*").order("created_at", { ascending: false });
    if (error) return notify(error.message, "error");
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), cases: data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ultrasound-cases-${new Date().toISOString().slice(0, 7)}.json`; a.click();
    URL.revokeObjectURL(url);
    notify("Case metadata JSON exported. Attached file archive/ZIP export is not included yet.", "success");
  }

  return <div className="page">
    <header className="topbar">
      <div className="brand"><div className="brandIcon"><Activity size={20}/></div><div><strong>Ultrasound</strong><small>Online Review & Reporting</small></div></div>
      <div className="rolePicker"><label htmlFor="role">Preview role</label><select id="role" value={role} onChange={(e) => { setRole(e.target.value); setTab(e.target.value === "Admin" ? "User Accounts" : e.target.value === "Sonologist" ? "Review Queue" : "My Cases"); setNotice(""); }}>
        {roles.map((item) => <option key={item}>{item}</option>)}
      </select></div>
    </header>

    <main className="shell">
      <section className="intro"><h1>Ultrasound</h1><p>Submit cases for review and track approval status.</p><nav className="tabs">{nav.map((item) => <button key={item} className={tab === item ? "tab active" : "tab"} onClick={() => setTab(item)}>{item}</button>)}</nav></section>
      {!configured && <div className="notice error"><AlertTriangle size={17}/> Supabase environment variables are missing. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeploy.</div>}
      {configured && <div className="testBanner"><AlertTriangle size={15}/> Temporary test mode: no login or role-based security yet. Use dummy patient data only.</div>}
      {notice && <div className={`notice ${noticeType}`} role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}

      {role === "Admin" && tab === "User Accounts" && <section className="panel"><h2>User Accounts</h2><p className="muted">Login and password management will be added after the case and file workflow is complete.</p><p className="empty">User account creation is intentionally not active in this development phase.</p></section>}
      {role === "Admin" && tab === "All Cases" && <CasePanel title="All Ultrasound Cases" cases={cases} loading={loading} onRefresh={refresh} onOpen={openCase}/>} 
      {role === "Admin" && tab === "Archive & Storage" && <section className="panel"><h2>Monthly Backup & Storage</h2><p className="muted">Export current case metadata. Full monthly ZIP backup/restore and verified deletion will be implemented after the case workflow is complete.</p><button className="primary" onClick={exportBackup}>Export Case Metadata (JSON)</button><div className="subheading"><h3>Online Ultrasound Storage</h3></div><p className="muted">Files are stored in the private Supabase Storage bucket: {BUCKET}.</p></section>}

      {role === "Sonographer" && <section className="panel">
        <div className="rowBetween"><div><h2>My Ultrasound Cases</h2><p className="muted">Track each case. After approval, open the case to print for patient dispatch.</p></div><div className="buttonRow"><button className="primary" onClick={() => { setShowAdd(true); setNotice(""); }}>+ Add Case</button><button className="secondary" onClick={refresh} disabled={loading}><RefreshCw size={14}/> Refresh</button></div></div>
        <Field label="Show cases"><select className="filter" value={filter} onChange={(e) => setFilter(e.target.value)}><option>Today + Yesterday</option><option>Today only</option><option>Select date range</option><option>All cases</option></select></Field>
        {filter === "Select date range" && <div className="dateRow"><Field label="From"><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}/></Field><Field label="To"><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}/></Field></div>}
        <CaseTable cases={filteredCases} loading={loading} onOpen={openCase}/>
      </section>}

      {role === "Sonologist" && <section className="panel">
        <div className="rowBetween"><div><h2>Cases Awaiting Final Review</h2><p className="muted">Open a case to view the submitted report and ultrasound images.</p></div><button className="secondary" onClick={refresh} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
        <CaseTable cases={filteredCases} loading={loading} onOpen={openCase}/>
      </section>}
      <footer>Ultrasound Online Review & Reporting <span>Development version 0.2.0</span></footer>
    </main>

    {showAdd && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setShowAdd(false); }}>
      <form className="modal" onSubmit={addCase}>
        <div className="rowBetween"><div><h2>Add Ultrasound Case</h2><p className="muted">Enter patient details and attach the report and ultrasound images.</p></div><button type="button" className="iconButton" onClick={() => !saving && setShowAdd(false)} disabled={saving}><X size={18}/></button></div>
        <Field label="Patient Name *"><input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Patient name" required disabled={saving}/></Field>
        <Field label="Lab Number *"><input value={labNumber} onChange={(e) => setLabNumber(e.target.value)} placeholder="Lab number" required disabled={saving}/></Field>
        <Attachment label="Report / Document *" files={reportFiles} setFiles={setReportFiles} uploadRef={reportUploadRef} cameraRef={reportCameraRef} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,image/*,application/pdf" help="Upload PDF/document or capture a photo directly. Multiple files are supported." disabled={saving}/>
        <Attachment label="Ultrasound Images *" files={imageFiles} setFiles={setImageFiles} uploadRef={imageUploadRef} cameraRef={imageCameraRef} accept="image/*,.jpg,.jpeg,.png,.webp" help="Upload multiple images or capture photos directly with your device camera." disabled={saving}/>
        <p className="hint">Maximum file size: 50 MB per file. Allowed formats: PDF, JPG, PNG, WEBP, DOC and DOCX.</p>
        <div className="modalActions"><button type="button" className="secondary" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? <><LoaderCircle size={15} className="spin"/> Saving case…</> : "Save & Send for Review"}</button></div>
      </form>
    </div>}

    {selectedCase && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busyAction) setSelectedCase(null); }}>
      <section className="modal caseModal">
        <div className="rowBetween"><div><h2>{selectedCase.patient_name}</h2><p className="muted">Lab Number: {selectedCase.lab_number} · {new Date(selectedCase.created_at).toLocaleString()}</p></div><button className="iconButton" onClick={() => setSelectedCase(null)}><X size={18}/></button></div>
        <p><span className="status">{prettyStatus(selectedCase.status)}</span></p>
        <h3><FileText size={16}/> Report / Documents</h3>
        <FileLinks files={signedFiles.reports}/>
        <h3><ImageIcon size={16}/> Ultrasound Images</h3>
        <div className="imageGrid">{signedFiles.images.map((file) => <a key={file.path} href={file.url || "#"} target="_blank" rel="noreferrer" className="imageThumb">{file.url ? <img src={file.url} alt={file.name}/> : <span>Preview unavailable</span>}<small>{file.name}</small></a>)}</div>
        {role === "Sonologist" && selectedCase.status !== "approved" && <><Field label="Review comments"><textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Enter comments or required corrections" rows="3"/></Field><div className="modalActions"><button className="secondary" onClick={() => updateCaseStatus("changes_requested")} disabled={busyAction}>Request Changes</button><button className="primary" onClick={() => updateCaseStatus("approved")} disabled={busyAction}><CheckCircle2 size={15}/> Approve Case</button></div></>}
        {role !== "Sonologist" && selectedCase.review_comment && <p className="reviewNote"><MessageSquare size={15}/> {selectedCase.review_comment}</p>}
      </section>
    </div>}
  </div>;
}

function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }

function Attachment({ label, files, setFiles, uploadRef, cameraRef, accept, help, disabled }) {
  const add = (list) => {
    const incoming = Array.from(list || []);
    setFiles((previous) => [...previous, ...incoming]);
    if (uploadRef.current) uploadRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };
  return <div className="field"><span>{label}</span>
    <div className="attachButtons">
      <button type="button" className="secondary" onClick={() => uploadRef.current?.click()} disabled={disabled}><Upload size={14}/> Upload from device</button>
      <button type="button" className="secondary" onClick={() => cameraRef.current?.click()} disabled={disabled}><Camera size={14}/> Take Photo</button>
    </div>
    <input ref={uploadRef} className="hiddenInput" type="file" accept={accept} multiple onChange={(e) => add(e.target.files)}/>
    <input ref={cameraRef} className="hiddenInput" type="file" accept="image/*" capture="environment" multiple onChange={(e) => add(e.target.files)}/>
    <p className="hint">{help}</p>
    {files.length > 0 && <ul className="fileList">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name} <small>({(file.size / 1024 / 1024).toFixed(2)} MB)</small></span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((previous) => previous.filter((_, i) => i !== index))} disabled={disabled}><X size={14}/></button></li>)}</ul>}
  </div>;
}

function CaseTable({ cases, loading, onOpen }) {
  if (loading) return <p className="empty"><LoaderCircle className="spin" size={16}/> Loading cases from Supabase…</p>;
  if (!cases.length) return <p className="empty">No ultrasound cases found for this selection.</p>;
  return <div className="tableWrap"><table><thead><tr><th>Patient</th><th>Lab Number</th><th>Date</th><th>Status</th><th>Attachments</th><th>Action</th></tr></thead><tbody>{cases.map((item) => <tr key={item.id}><td>{item.patient_name}</td><td>{item.lab_number}</td><td>{new Date(item.created_at).toLocaleString()}</td><td><span className={`status ${item.status}`}>{prettyStatus(item.status)}</span></td><td>{(item.report_files?.length || 0)} report · {(item.ultrasound_files?.length || 0)} images</td><td><button className="secondary smallButton" onClick={() => onOpen(item)}><Eye size={13}/> Open</button></td></tr>)}</tbody></table></div>;
}

function CasePanel({ title, cases, loading, onRefresh, onOpen }) {
  return <section className="panel"><div className="rowBetween"><h2>{title}</h2><button className="secondary" onClick={onRefresh} disabled={loading}><RefreshCw size={14}/> Refresh</button></div><CaseTable cases={cases} loading={loading} onOpen={onOpen}/></section>;
}

function FileLinks({ files }) {
  if (!files.length) return <p className="empty">No report files.</p>;
  return <ul className="fileList">{files.map((file) => <li key={file.path}><span>{file.name}</span>{file.url ? <a href={file.url} target="_blank" rel="noreferrer">Open file</a> : <small>{file.error || "Unavailable"}</small>}</li>)}</ul>;
}

function prettyStatus(status) {
  return ({ awaiting_review: "Awaiting review", in_review: "In review", changes_requested: "Changes requested", approved: "Approved", archived: "Archived" })[status] || status;
}

export default App;
