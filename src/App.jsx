import React, { useEffect, useState } from 'react';
import { onValue, ref, remove, update } from 'firebase/database';
import { database } from './firebase';
import { Activity, Bell, CalendarDays, CheckCircle2, ChevronDown, Circle, CircleAlert, ClipboardList, Clock3, Cpu, Download, Droplets, Filter, Home, Layers3, Leaf, Menu, Package, Play, RefreshCw, Search, Settings, ShieldCheck, SlidersHorizontal, Wifi, ArrowUpRight, ArrowLeftRight, Gauge, X, Radio, History, AlertTriangle, RotateCcw } from 'lucide-react';

const navigation = [['Dashboard', Home], ['Live Monitoring', Activity], ['Production History', ClipboardList], ['Notifications', Bell], ['Settings', Settings]];
const stages = [
  ['Dehusking', 'Process the kapok pods'],
  ['Closing Separation Storage', 'Close the separation storage door'],
  ['Separation', 'Separate fiber from shell and seeds'],
  ['Opening Cotton Storage', 'Open the cotton storage door'],
  ['Transferring', 'Transfer the separated material'],
  ['Closing Cotton Storage', 'Close the cotton storage door'],
  ['Opening Separation Storage', 'Open the separation storage door'],
  ['Liquid extraction', 'Prepare repellent extract', ['Dispensing Water', 'Cooking', 'Cooling', 'Transfer Cooked Juice']],
  ['Repellent mixing', 'Mix liquid ingredients', ['Dispensing Repellent', 'Mixing', 'Final Liquid Transfer']],
  ['Cotton filling', 'Pillow filling cycle'],
];
const normalizeStage = value => String(value ?? '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const formatEventLabel = value => String(value ?? 'Production event').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, char => char.toUpperCase());
const stageMatches = (value, name) => normalizeStage(value) === normalizeStage(name);
const substageMatches = (reportedValue, expectedValue) => {
  const reported = normalizeStage(reportedValue);
  const expected = normalizeStage(expectedValue);
  if (reported === expected) return true;

  // Controllers may say "Transferring..." while the dashboard label uses "Transfer...".
  if (expected === 'transfer cooked juice') {
    return /transferr?(?:ing|ed)? .*?(?:cooked juice|cooked extract|extract)/.test(reported) ||
      /transfer .*?(?:cooked juice|cooked extract|extract)/.test(reported) ||
      /(?:cooked juice|cooked extract|extract).*transferr?(?:ing|ed)?/.test(reported);
  }
  if (expected === 'final liquid transfer') {
    return /final .*liquid transfer/.test(reported) ||
      /final transfer/.test(reported) ||
      /transferr?(?:ing|ed)? .*?(?:liquid|mixture|repellent)/.test(reported) ||
      /(?:liquid|mixture|repellent).*transferr?(?:ing|ed)?/.test(reported);
  }
  return false;
};
const getStageLocationDescription = (name, machineData) => {
  const stage = normalizeStage(name);
  const process = normalizeStage(machineData?.currentProcess);
  const reportedStage = normalizeStage(machineData?.processStage);
  if (stage === 'opening separation storage' || stage === 'closing separation storage') {
    return 'Storage: Separation Storage';
  }
  if (stage === 'opening cotton storage' || stage === 'closing cotton storage') {
    return 'Storage: Cotton Storage';
  }
  if (stage === 'opening' || stage === 'closing') {
    if (process.includes('separation storage') || reportedStage.includes('separation storage')) return 'Storage: Separation Storage';
    if (process.includes('cotton storage') || reportedStage.includes('cotton storage')) return 'Storage: Cotton Storage';
    return 'Storage location: waiting for controller data';
  }
  return null;
};
const getStageState = (machineData, name, index, substages = []) => {
  const process = machineData?.currentProcess;
  const stage = machineData?.processStage;
  const p = normalizeStage(process);
  const st = normalizeStage(stage);
  // Match controller wording variations for transfer stages.
  const isTransferCookedJuice =
    /transfer.*(cooked juice|cooked extract|extract)/.test(st) ||
    /(cooked juice|cooked extract|extract).*transfer/.test(st);
  const isFinalLiquidTransfer =
    /final liquid transfer/.test(st) ||
    (/transfer/.test(st) && /liquid|mixture|repellent/.test(st));
  const substageActive = substages.some(item => substageMatches(stage, item));
  const belongsToMain = p.includes(normalizeStage(name)) ||
    (name === 'Liquid extraction' && /liquid|extract|cook|water|cool|transfer/.test(p)) ||
    (name === 'Repellent mixing' && /repellent|mix|final liquid transfer|liquid transfer/.test(p));
  const fiberExtractionFinished =
    p.includes('fiber extraction completed') ||
    st.includes('fiber extraction completed') ||
    p === 'process completed' ||
    st === 'process completed';
  // A stage is active only when the controller explicitly reports it.
  // The final fiber stage shares index 6 with the completion marker, so
  // distinguish "Opening Separation Storage" from the later waiting state.
  // A controller can report the active transfer as the process name itself
  // rather than the parent process (Liquid extraction / Repellent mixing).
  // Since substage names are unique in this workflow, an explicit substage
  // match should highlight it regardless of the parent process label.
  const active = !fiberExtractionFinished &&
    (stageMatches(process, name) || stageMatches(stage, name) || substageActive);
  const reportedStageIndex = Number(machineData?.completedStageIndex);
  const completed = (Number.isFinite(reportedStageIndex) && reportedStageIndex > index) ||
    (index === 6 && fiberExtractionFinished);
  const interrupted = normalizeStage(machineData?.lastEventType) === 'process interrupted' && (active || stageMatches(process, 'Interrupted'));
  const label = interrupted ? 'Interrupted' : active ? 'Running' : completed ? 'Completed' : 'Waiting for stage';
  return { active, completed, interrupted, label };
};
const sampleEvents = [
  {time:'No records yet', title:'Production history is empty', detail:'Completed batches will appear here after Firebase is connected.', type:'info'},
];

export default function App() {
  const [page, setPage] = useState('Dashboard');
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const [period, setPeriod] = useState('Today');
  const [filter, setFilter] = useState('All notifications');
  const [query, setQuery] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const [pillowCount, setPillowCount] = useState(0);
  const [pillowDispensing, setPillowDispensing] = useState(false);
  const [machineData, setMachineData] = useState(null);
  const [productionSummary, setProductionSummary] = useState(null);
  const [productionHistory, setProductionHistory] = useState([]);
  const [productionReportRange, setProductionReportRange] = useState('Day');
  const [notificationData, setNotificationData] = useState([]);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState('Connecting');
  useEffect(() => {
    const unsubscribe = onValue(ref(database, 'machine/latest'), (snapshot) => {
      setMachineData(snapshot.exists() ? snapshot.val() : null);
      setFirebaseStatus('Connected');
    }, () => setFirebaseStatus('Connection error'));
    const offSummary = onValue(ref(database, 'production/summary'), snap => setProductionSummary(snap.exists() ? snap.val() : null));
    const offHistory = onValue(ref(database, 'production/history'), snap => { const val = snap.exists() ? snap.val() : {}; setProductionHistory(Object.entries(val).map(([id,item]) => ({id,...item})).sort((a,b) => Number(b.createdAt||0)-Number(a.createdAt||0))); });
    const offNotifications = onValue(ref(database, 'notifications'), snap => { const val = snap.exists() ? snap.val() : {}; setNotificationData(Object.entries(val).map(([id,item]) => ({id,...item})).sort((a,b) => Number(b.createdAt||0)-Number(a.createdAt||0))); });
    return () => { unsubscribe(); offSummary(); offHistory(); offNotifications(); };
  }, []);
  const go = (name) => { setPage(name); setMenu(false); setNotice(''); };
  const inform = (message) => setNotice(message);
  const unreadCount = notificationData.filter(item => item.read !== true).length;
  const markNotificationRead = async (item) => { try { await update(ref(database, `notifications/${item.id}`), { read: true, readAt: Date.now() }); } catch (error) { inform('Could not mark notification as read. Check Firebase database rules.'); } };
  const deleteNotification = async (item) => { try { await remove(ref(database, `notifications/${item.id}`)); inform('Notification deleted.'); } catch (error) { inform('Could not delete notification. Check Firebase database rules.'); } };
  const markAllNotificationsRead = async () => { try { await Promise.all(notificationData.filter(item => item.read !== true).map(item => remove(ref(database, `notifications/${item.id}`)))); inform('All unread notifications deleted.'); } catch (error) { inform('Could not delete notifications. Check Firebase database rules.'); } };
  const refresh = () => { setRefreshCount(v => v + 1); inform('Demo data refreshed. Live readings will appear after Firebase and controller integration.'); };
  return <div className="app">
    <aside className={'sidebar ' + (menu ? 'open' : '')}>
      <div className="brand"><div className="logo"><Leaf size={23}/></div><div><b>BUBOSOFT</b><small>SHIELD · MACHINE SYSTEM</small></div></div>
      <label>WORKSPACE</label>
      {navigation.map(([name, Icon]) => <button key={name} className={'nav ' + (page === name ? 'selected' : '')} onClick={() => go(name)}><Icon size={18}/>{name}{name === 'Alerts & Logs' && <i className="nav-dot"/>}</button>)}
      <div className="side-bottom"><div className="help"><ShieldCheck/><div><b>Machine workspace</b><small>Monitoring prototype</small></div></div><div className="user"><div className="avatar">BS</div><div><b>System Operator</b><small>Preview account</small></div><ChevronDown size={16}/></div></div>
    </aside>
    {menu && <button className="scrim" aria-label="Close menu" onClick={() => setMenu(false)}/>}
    <main><header><div className="crumb"><button className="hamb" onClick={() => setMenu(!menu)} aria-label="Toggle menu"><Menu/></button>Workspace <span>/</span> <b>{page}</b></div><div className="topright"><span className="demo"><i/> Firebase: {firebaseStatus}</span><div className="bell-wrap">
            <button className="bell" aria-label="Open notifications" aria-expanded={notificationMenuOpen} onClick={() => setNotificationMenuOpen(v => !v)}><Bell size={18}/>{unreadCount > 0 && <span className="bell-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>
            {notificationMenuOpen && <div className="notification-popover">
              <div className="notification-popover-head"><div><b>Notifications</b><small>{unreadCount ? unreadCount + ' unread · ' : ''}{notificationData.length ? notificationData.length + ' total event' + (notificationData.length === 1 ? '' : 's') : 'No notifications yet'}</small></div><div className="notification-popover-head-actions">{unreadCount > 0 && <button className="mark-all-read" onClick={markAllNotificationsRead}>Mark all read</button>}<button aria-label="Close notifications" onClick={() => setNotificationMenuOpen(false)}><X size={15}/></button></div></div>
              {notificationData.length === 0 ? <div className="notification-popover-empty"><Bell size={20}/><span>No notifications yet</span></div> : <div className="notification-popover-list">{notificationData.slice(0,5).map(item => <div className={'notification-popover-item ' + (item.read === true ? 'is-read' : 'is-unread')} key={item.id}><button className="notification-popover-item-main" onClick={() => { if (item.read !== true) markNotificationRead(item); setNotificationMenuOpen(false); go('Notifications'); }}><span className="notification-popover-icon"><Bell size={15}/></span><span className="notification-popover-copy"><b>{item.title || item.event || item.type || 'Machine notification'}</b><small>{item.detail || item.message || item.machineStatus || 'Notification received from Firebase'}</small><em>{item.createdAt ? new Date(Number(item.createdAt)).toLocaleString() : 'Time unavailable'}</em></span></button>{item.read !== true && <button className="notification-mark-read" aria-label="Mark notification as read" title="Mark as read" onClick={() => markNotificationRead(item)}>Mark read</button>}<button className="notification-mark-read" aria-label="Delete notification" title="Delete notification" onClick={() => deleteNotification(item)}>Delete</button></div>)}</div>}
              <button className="notification-popover-all" onClick={() => { setNotificationMenuOpen(false); go('Notifications'); }}>View all notifications <ArrowUpRight size={14}/></button>
            </div>}
          </div><span className="date"><CalendarDays size={16}/> Machine overview</span></div></header>
      <div className="content">
        {notice && <div className="notice"><CircleAlert size={17}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}
        {page === 'Dashboard' && <Dashboard go={go} inform={inform} refresh={refresh} period={period} setPeriod={setPeriod} refreshCount={refreshCount} pillowCount={pillowCount} machineData={machineData} productionSummary={productionSummary} productionHistory={productionHistory} firebaseStatus={firebaseStatus}/>}
        {page === 'Live Monitoring' && <LiveMonitoring inform={inform} machineData={machineData} firebaseStatus={firebaseStatus}/>}
        {page === 'Production History' && <ProductionHistory query={query} setQuery={setQuery} period={period} setPeriod={setPeriod} productionSummary={productionSummary} productionHistory={productionHistory} productionReportRange={productionReportRange} setProductionReportRange={setProductionReportRange}/>}
        {page === 'Notifications' && <Alerts filter={filter} setFilter={setFilter} notificationData={notificationData}/>}
        {page === 'Settings' && <SettingsPage inform={inform} machineData={machineData} firebaseStatus={firebaseStatus}/>}
        <footer>© 2026 BUBOSOFT SHIELD <span><ShieldCheck size={14}/> Machine monitoring interface · Preview build 0.2.0</span></footer>
      </div></main></div>;
}
function PageHeading({eyebrow='SMART MACHINE MONITORING', title, subtitle, children}) { return <div className="welcome"><div><div className="eyebrow"><i/> {eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{children && <div className="actions">{children}</div>}</div>; }
function SectionTitle({title, subtitle, right}) { return <div className="section-title"><div><h2>{title}</h2><p>{subtitle}</p></div>{right}</div>; }
function Dashboard({go, inform, refresh, period, setPeriod, refreshCount, pillowCount, machineData, productionSummary, productionHistory, firebaseStatus}) {
  const sensors = machineData?.sensors || {};
  const hasCottonData = typeof sensors.middleCottonLaser === 'boolean' || typeof sensors.bottomCottonLaser === 'boolean';
  const hasLiquidData = typeof sensors.halfLiquidSensor === 'boolean' || typeof sensors.fullLiquidSensor === 'boolean';
  // Interpret the two cotton level sensors as a 3-state level indicator.
  // Assumption: middle sensor true means at least HALF; bottom sensor true means FULL.
  const cottonLevel = !hasCottonData ? 'No data' : sensors.bottomCottonLaser === true ? 'Full' : sensors.middleCottonLaser === true ? 'Half' : 'Empty';
  const signalLabel = value => value === undefined || value === null ? '—' : typeof value === 'boolean' ? (value ? 'HIGH' : 'LOW') : String(value);
  const actuatorStatus = value => {
    if (value === undefined || value === null || value === '') return 'Waiting for actuator data';
    const v = String(value).toLowerCase().replace(/[_-]+/g, ' ').trim();
    if (['open','opened','fully open'].includes(v)) return 'Open';
    if (['close','closed','fully closed'].includes(v)) return 'Closed';
    if (['opening','moving open'].includes(v)) return 'Opening';
    if (['closing','moving closed'].includes(v)) return 'Closing';
    if (['running','moving'].includes(v)) return 'Moving';
    if (['idle','standby','stopped'].includes(v)) return 'Idle';
    return String(value);
  };
  const separationActuator = actuatorStatus(machineData?.separationStorageActuator ?? machineData?.actuators?.separationStorage);
  const cottonActuator = actuatorStatus(machineData?.cottonStorageActuator ?? machineData?.actuators?.cottonStorage);
  const actuatorCards = [
    { name: 'Linear Actuator 1', storage: 'Separation Storage', status: separationActuator, detail: 'Opens and closes the separation storage.' },
    { name: 'Linear Actuator 2', storage: 'Cotton Storage', status: cottonActuator, detail: 'Opens and closes the cotton storage.' }
  ];
  const liquidLabel = !hasLiquidData ? 'No data' : sensors.fullLiquidSensor ? 'Full' : sensors.halfLiquidSensor ? 'Half' : 'Empty';
  const machineLabel = machineData?.status ? String(machineData.status).toLowerCase().replace(/\b\w/g, char => char.toUpperCase()) : 'Waiting for data';
  const summaryStart = new Date();
  if (period === 'Today') summaryStart.setHours(0,0,0,0);
  else if (period === 'This week') { summaryStart.setDate(summaryStart.getDate() - ((summaryStart.getDay()+6)%7)); summaryStart.setHours(0,0,0,0); }
  else if (period === 'This month') { summaryStart.setDate(1); summaryStart.setHours(0,0,0,0); }
  else if (period === 'This year') { summaryStart.setMonth(0,1); summaryStart.setHours(0,0,0,0); }
  const periodCounts = (() => {
    const events = [...productionHistory].filter(item => item.createdAt).sort((a,b) => Number(a.createdAt)-Number(b.createdAt));
    let previousContainers = null, previousPillows = null, containers = 0, pillows = 0;
    events.forEach(item => {
      const timestamp = Number(item.createdAt);
      const inRange = timestamp >= summaryStart.getTime() && timestamp <= Date.now();
      const containerRaw = item.repellentContainerCount ?? item.repellentContainersProcessed ?? item.containerCountAfter;
      const pillowRaw = item.pillowsProduced ?? item.pillowCount ?? item.pillowCountAfter;
      const containerNow = containerRaw == null || !Number.isFinite(Number(containerRaw)) ? null : Number(containerRaw);
      const pillowNow = pillowRaw == null || !Number.isFinite(Number(pillowRaw)) ? null : Number(pillowRaw);
      const containerDeltaRaw = item.repellentContainerDelta ?? item.containerDelta;
      const pillowDeltaRaw = item.pillowDelta ?? item.pillowsProducedDelta ?? item.pillowCountDelta;
      if (containerDeltaRaw != null && Number.isFinite(Number(containerDeltaRaw))) { if (inRange) containers += Math.max(0, Number(containerDeltaRaw)); }
      else if (containerNow !== null && previousContainers !== null && inRange) containers += Math.max(0, containerNow-previousContainers);
      else if (inRange && /process completed/i.test(String(item.event || item.title || item.type || ''))) containers += 1;
      if (pillowDeltaRaw != null && Number.isFinite(Number(pillowDeltaRaw))) { if (inRange) pillows += Math.max(0, Number(pillowDeltaRaw)); }
      else if (pillowNow !== null && previousPillows !== null && inRange) pillows += Math.max(0, pillowNow-previousPillows);
      if (containerNow !== null) previousContainers = containerNow;
      if (pillowNow !== null) previousPillows = pillowNow;
    });
    return {containers,pillows};
  })();
  const summaryContainerCount = periodCounts.containers;
  const summaryPillowCount = periodCounts.pillows;
  const summaryHasPeriodData = productionHistory.some(item => Number(item.createdAt) >= summaryStart.getTime() && Number(item.createdAt) <= Date.now() && (item.repellentContainerDelta != null || item.containerDelta != null || item.pillowDelta != null || item.pillowsProducedDelta != null || item.pillowCountDelta != null || item.repellentContainerCount != null || item.repellentContainersProcessed != null || item.containerCountAfter != null || item.pillowsProduced != null || item.pillowCount != null || item.pillowCountAfter != null));
  return <><PageHeading title="Good day, Operator" subtitle="Monitor your kapok processing and repellent production system." />
    <SectionTitle title="System overview" subtitle="Live indicators from Firebase" />
    <div className="stats"><Stat icon={Cpu} tone="green" label="Machine Status" value={machineLabel} meta={machineData ? (machineData.demoMode ? 'Simulated ESP32 reading' : 'Latest controller reading') : 'Waiting for machine/latest'} tag={machineData ? 'RECEIVING' : 'NO DATA'}/><Stat icon={Layers3} tone="blue" label="Current Process" value={machineData?.currentProcess ? String(machineData.currentProcess).toLowerCase().replace(/\b\w/g, char => char.toUpperCase()) : 'Not Reported'} meta={machineData?.processStage || 'No active stage reported'} tag={machineData?.currentProcess ? 'ACTIVE' : 'UNKNOWN'}/><Stat icon={Package} tone="orange" label="Cotton Storage" value={cottonLevel} meta={`Middle: ${signalLabel(sensors.middleCottonLaser)} · Bottom: ${signalLabel(sensors.bottomCottonLaser)}`} tag={hasCottonData ? 'SENSOR DATA' : 'NO DATA'}/><Stat icon={Droplets} tone="purple" label="Liquid Storage" value={liquidLabel} meta={`Half: ${signalLabel(sensors.halfLiquidSensor)} · Full: ${signalLabel(sensors.fullLiquidSensor)}`} tag={hasLiquidData ? 'SENSOR DATA' : 'NO DATA'}/></div>
    <div className="columns single-panel"><section className="panel"><div className="panel-head"><div><h2>Production process</h2><p>Track the full production workflow</p></div><button className="link" onClick={() => go('Live Monitoring')}>View details <ArrowUpRight size={15}/></button></div><div className="process-summary"><div className="sumicon"><Activity/></div><div><b>{machineData?.currentProcess || 'No active batch reported'}</b><small>{machineData?.processStage || 'Detailed process-stage data has not been sent by the ESP32 yet.'}</small></div><span>{machineData ? 'CONNECTED' : 'STANDBY'}</span></div>{stages.map(([name, desc, substages], index) => { const {active, completed, interrupted, label} = getStageState(machineData, name, index, substages || []); const currentSubstage = machineData?.processStage; return <React.Fragment key={name}><div className={'stage ' + (active ? 'stage-active' : completed ? 'stage-complete' : interrupted ? 'stage-interrupted' : '')}><div className="stage-icon"><Circle size={17}/></div><div className="stage-name"><b>{name}</b><small>{desc}</small></div><span>{label}</span><em>{active ? '●' : completed ? '✓' : interrupted ? '!' : '—'}</em></div>{substages && <div className="stage-substage-list" aria-label={name + ' substages'} style={{display:'flex', flexWrap:'wrap', alignItems:'center', gap:'8px', margin:'8px 0 12px 48px'}}>{substages.map(substage => <span key={substage} className={'stage-substage ' + (substageMatches(currentSubstage, substage) ? 'stage-substage-active' : '')} style={{display:'inline-flex', alignItems:'center', gap:'5px', padding:'6px 10px', borderRadius:'999px', border:'1px solid ' + (substageMatches(currentSubstage, substage) ? '#27875b' : '#dce5e0'), background:substageMatches(currentSubstage, substage) ? '#eaf7ef' : '#f7f9f8', color:substageMatches(currentSubstage, substage) ? '#176b43' : '#5f6b65', fontSize:'12px', lineHeight:1.4, whiteSpace:'nowrap'}}>{substage}{substageMatches(currentSubstage, substage) ? ' · Running' : ''}</span>)}</div>}</React.Fragment>; })}<div className="panel-foot"><span><Clock3 size={15}/> Stage durations not available</span><button onClick={() => go('Production History')}>View batch history ↗</button></div></section>
    </div>
    <div className="columns bottom single-panel"><section className="panel"><div className="panel-head"><div><h2>Production summary</h2><p>Batch overview for selected period</p></div><select aria-label="Production period" value={period} onChange={e=>setPeriod(e.target.value)}><option>Today</option><option>This week</option><option>This month</option><option>This year</option></select></div><div className="metrics summary-metrics">{[['Repellent containers processed',summaryHasPeriodData ? summaryContainerCount : '—'],['Pillows produced',summaryHasPeriodData ? summaryPillowCount : '—']].map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b><em>{summaryHasPeriodData ? 'Calculated from recorded production events' : 'No count snapshots for this period yet'}</em></div>)}</div><div className="empty"><Activity/><b>{productionHistory.length ? productionHistory.length + ' recorded history events' : 'No production history yet'}</b><small>Records received from production/history appear here.</small><button className="link" onClick={() => go('Production History')}>Open production history <ArrowUpRight size={15}/></button></div></section>
    </div>
  </>;
}
function LiveMonitoring({inform, machineData, firebaseStatus}) {
  const sensors = machineData?.sensors || {};
  const signalLabel = value => value === undefined || value === null ? '—' : typeof value === 'boolean' ? (value ? 'HIGH' : 'LOW') : String(value);
  const sensorRows = [
    ['middleCottonLaser', 'Middle Cotton Laser', 'Cotton Level'],
    ['bottomCottonLaser', 'Bottom Cotton Laser', 'Cotton Level'],
    ['halfLiquidSensor', 'Half Liquid Sensor', 'Liquid Level'],
    ['fullLiquidSensor', 'Full Liquid Sensor', 'Liquid Level']
  ];
  return (
    <>
      <PageHeading eyebrow="MACHINE TELEMETRY" title="Live Monitoring" subtitle="Review configured sensor inputs and machine process states." />
      <section className="panel stage-panel">
        <div className="panel-head">
          <div><h2>Process stage monitor</h2><p>Monitor each production stage reported by the machine.</p></div>
          <span className="monitor-count"><Activity size={14}/> {stages.length} production stages</span>
        </div>
        <div className="stage-grid">
          {stages.map(([name, desc, substages], index) => {
            const state = getStageState(machineData, name, index, substages || []);
            const currentSubstage = machineData?.processStage;
            const locationDescription = getStageLocationDescription(name, machineData);
            return (
              <div className={'stage-card ' + (state.active ? 'stage-card-active' : state.completed ? 'stage-card-complete' : state.interrupted ? 'stage-card-interrupted' : '')} key={name}>
                <div className="stage-card-top">
                  <div className="stage-card-icon"><Circle size={18}/></div>
                  <span className="stage-number">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <b>{name}</b>
                <small>{desc}</small>
                {locationDescription && <small className="stage-location-description">{locationDescription}</small>}
                <span className="stage-waiting"><i/> {state.label}</span>
                {Array.isArray(substages) && substages.length > 0 && (
                  <div className="stage-card-substages" style={{display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'10px'}}>
                    {substages.map(substage => (
                      <span key={substage} className={substageMatches(currentSubstage, substage) ? 'substage-active' : ''} style={{display:'inline-flex', alignItems:'center', padding:'5px 8px', borderRadius:'999px', border:'1px solid ' + (substageMatches(currentSubstage, substage) ? '#27875b' : '#dce5e0'), background:substageMatches(currentSubstage, substage) ? '#eaf7ef' : '#f7f9f8', color:substageMatches(currentSubstage, substage) ? '#176b43' : '#5f6b65', fontSize:'11px', lineHeight:1.4, whiteSpace:'nowrap'}}>
                        {substage}{substageMatches(currentSubstage, substage) ? ' · Active' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div><h2>Sensor inputs</h2><p>Pin references from the current project plan</p></div>
          <span className="sample"><i/> {String(firebaseStatus || 'Connecting').toUpperCase()}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Sensor</th><th>Purpose</th><th>Current value</th><th>Status</th></tr></thead>
            <tbody>
              {sensorRows.map(([key, name, purpose]) => {
                const value = sensors[key];
                const hasValue = value !== undefined && value !== null;
                return (
                  <tr key={key}>
                    <td>{name}</td><td>{purpose}</td><td>{signalLabel(value)}</td>
                    <td><span className={'pill ' + (hasValue ? 'good' : 'muted')}>{hasValue ? 'Live' : 'No data'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function ProductionHistory({period,setPeriod,productionSummary,productionHistory,productionReportRange,setProductionReportRange}) {
  const [resettingBaseline, setResettingBaseline] = useState(false);
  const resetAt = Number(productionSummary?.resetAt || 0);
  const activeHistory = productionHistory.filter(item => Number(item.createdAt || 0) > resetAt);
  const resetProductionBaseline = async () => {
    if (resettingBaseline) return;
    const confirmed = window.confirm('Start a new production-count session at zero? Old history will be preserved, but totals and graphs will count only records created after this reset.');
    if (!confirmed) return;
    setResettingBaseline(true);
    try {
      const now = Date.now();
      await update(ref(database, 'production/summary'), {
        resetAt: now,
        repellentContainerCount: 0,
        repellentContainersProcessed: 0,
        updatedAt: now
      });
    } catch (error) {
      console.error('Could not reset production baseline', error);
      window.alert('Could not reset production counts. Check Firebase Database rules and try again.');
    } finally {
      setResettingBaseline(false);
    }
  };
  const labels = period === 'This week' ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] : period === 'This month' ? ['Week 1','Week 2','Week 3','Week 4'] : period === 'This year' ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] : ['Today'];
  const periods = <select value={period} onChange={e=>setPeriod(e.target.value)} aria-label="Chart date range"><option>Today</option><option>This week</option><option>This month</option><option>This year</option></select>;
  return <><PageHeading eyebrow="PRODUCTION ANALYTICS" title="Production History" subtitle="Track repellent containers processed, completed pillows, and production events over time." />
    <div className="stats"><Stat icon={Droplets} tone="green" label="Overall repellent containers" value={activeHistory.filter(item => /process completed/i.test([item.event,item.eventType,item.title,item.type,item.machineStatus,item.status,item.details,item.message].filter(Boolean).join(' ').replace(/[_-]+/g, ' ')) && !/process interrupted/i.test([item.event,item.eventType,item.title,item.type,item.machineStatus,item.status,item.details,item.message].filter(Boolean).join(' ').replace(/[_-]+/g, ' '))).length} meta="Count of completed records in Firebase history" tag={activeHistory.length || productionSummary ? 'RECORDED' : 'EMPTY'}/><Stat icon={Package} tone="blue" label="Overall pillows produced" value={Math.max((() => { const events = [...activeHistory].filter(item => item.createdAt).sort((a,b) => Number(a.createdAt)-Number(b.createdAt)); let total = 0, previous = null; events.forEach(item => { const deltaRaw = item.pillowDelta ?? item.pillowsProducedDelta ?? item.pillowCountDelta; const snapshotRaw = item.lifetimePillowsProduced ?? item.pillowsProduced ?? item.pillowCount ?? item.pillowCountAfter; if (deltaRaw != null && Number.isFinite(Number(deltaRaw))) total += Math.max(0, Number(deltaRaw)); else if (snapshotRaw != null && Number.isFinite(Number(snapshotRaw))) { const current = Math.max(0, Number(snapshotRaw)); if (previous !== null) total += Math.max(0, current-previous); previous = current; } else if (/pillow produced/i.test(String(item.event || item.title || item.type || ''))) total += 1; }); return total; })(), ...activeHistory.map(item => { const count = item.lifetimePillowsProduced ?? item.pillowsProduced ?? item.pillowCount ?? item.pillowCountAfter; return count !== undefined && count !== null && Number.isFinite(Number(count)) ? Number(count) : 0; }), Number(productionSummary?.lifetimePillowsProduced ?? productionSummary?.pillowsProduced ?? productionSummary?.pillowCount ?? 0), 0)} meta="Lifetime total from summary and pillow history" tag={activeHistory.length || productionSummary ? 'RECORDED' : 'EMPTY'}/><Stat icon={CheckCircle2} tone="purple" label="Completed processes" value={activeHistory.filter(item => { const eventText = [item.event,item.eventType,item.title,item.type,item.machineStatus,item.status,item.details,item.message].filter(Boolean).join(' ').replace(/[_-]+/g, ' '); return /process completed/i.test(eventText) && !/process interrupted/i.test(eventText); }).length} meta="Successful process completion events" tag={activeHistory.some(item => /process completed/i.test([item.event,item.eventType,item.title,item.type,item.machineStatus,item.status,item.details,item.message].filter(Boolean).join(' ').replace(/[_-]+/g, ' '))) ? 'RECORDED' : 'EMPTY'}/><Stat icon={AlertTriangle} tone="orange" label="Interrupted processes" value={activeHistory.filter(item => /process interrupted/i.test([item.event,item.eventType,item.title,item.type,item.machineStatus,item.status,item.details,item.message].filter(Boolean).join(' ').replace(/[_-]+/g, ' '))).length} meta="Processes stopped before completion" tag={activeHistory.some(item => /process interrupted/i.test([item.event,item.eventType,item.title,item.type,item.machineStatus,item.status,item.details,item.message].filter(Boolean).join(' ').replace(/[_-]+/g, ' '))) ? 'RECORDED' : 'EMPTY'}/></div>
    {(() => {
      const now = new Date();
      const start = new Date(now);
      if (productionReportRange === 'Day') {
        start.setHours(0, 0, 0, 0);
      } else if (productionReportRange === 'Week') {
        const day = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - day);
        start.setHours(0, 0, 0, 0);
      } else if (productionReportRange === 'Month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
      } else {
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
      }
      const end = new Date(now);
      const all = [...activeHistory].filter(item => item.createdAt).sort((a,b) => Number(a.createdAt)-Number(b.createdAt));
      let containers = 0;
      let pillows = 0;
      all.forEach(item => {
        const timestamp = Number(item.createdAt);
        const inRange = timestamp >= start.getTime() && timestamp <= end.getTime();
        const eventName = String(item.event || item.title || item.type || item.machineStatus || item.details || item.message || '').replace(/[_-]+/g, ' ').toLowerCase();
        if (!inRange) return;
        // Only successful completed-process records count as repellent containers.
        // Interrupted events and cumulative ESP32 snapshots never increase this total.
        if (eventName.includes('process completed')) containers += 1;
        const explicitPillowDelta = item.pillowDelta ?? item.pillowsProducedDelta ?? item.pillowCountDelta;
        if (explicitPillowDelta !== undefined && explicitPillowDelta !== null && Number.isFinite(Number(explicitPillowDelta))) {
          pillows += Math.max(0, Number(explicitPillowDelta));
        } else if (/pillow produced/.test(eventName)) {
          pillows += 1;
        }
      });

      const dateOptions = {month:'short', day:'numeric', year:'numeric'};
      const rangeText = `${start.toLocaleDateString(undefined,dateOptions)} – ${now.toLocaleDateString(undefined,dateOptions)}`;
      return <section className="panel production-period-panel">
        <div className="panel-head"><div><h2>Production by period</h2><p>Completed output grouped by recorded date and time</p></div>
          <div className="period-selector" role="group" aria-label="Production report period">
            {['Day','Week','Month','Year'].map(option=><button type="button" key={option} className={productionReportRange===option?'active':''} onClick={()=>setProductionReportRange(option)}>{option}</button>)}
          </div>
        </div>
        <div className="production-period-dates"><CalendarDays size={14}/><span>{rangeText}</span></div>
        <div className="production-period-stats">
          <div className="period-stat"><span className="period-stat-icon green"><Droplets size={17}/></span><span className="period-stat-label">Repellent containers</span><strong>{containers}</strong><small>Completed in this {productionReportRange.toLowerCase()}</small></div>
          <div className="period-stat"><span className="period-stat-icon blue"><Package size={17}/></span><span className="period-stat-label">Pillows produced</span><strong>{pillows}</strong><small>Completed in this {productionReportRange.toLowerCase()}</small></div>
        </div>
        <div className="chart-footnote"><Radio size={14}/> Repellent totals count completed production records in Firebase history. Interrupted processes are excluded.</div>
      </section>;
    })()}
    {(() => {
      const allEvents = [...activeHistory]
        .filter(item => item.createdAt)
        .sort((a,b) => Number(a.createdAt) - Number(b.createdAt));
      const completedEvents = allEvents.filter(item => /process completed/i.test(String(item.event || item.title || item.type || '').replace(/[_-]+/g, ' ')));
      const pillowEvents = allEvents.filter(item => /pillow produced/i.test(String(item.event || item.title || item.type || '')));
      const hasContainerSummary = productionSummary && (productionSummary.repellentContainerCount !== undefined || productionSummary.repellentContainersProcessed !== undefined);
      const hasPillowSummary = productionSummary && (productionSummary.lifetimePillowsProduced !== undefined || productionSummary.pillowsProduced !== undefined || productionSummary.pillowCount !== undefined);
      const derivedContainerTotal = completedEvents.length;
      // Use the same event-delta / cumulative-snapshot interpretation as the period report.
      // This prevents the lifetime card from lagging behind output counted in today's report.
      let derivedPillowTotal = 0;
      let previousLifetimePillows = null;
      allEvents.forEach(item => {
        const rawDelta = item.pillowDelta ?? item.pillowsProducedDelta ?? item.pillowCountDelta;
        const rawSnapshot = item.lifetimePillowsProduced ?? item.pillowsProduced ?? item.pillowCount ?? item.pillowCountAfter;
        if (rawDelta !== undefined && rawDelta !== null && Number.isFinite(Number(rawDelta))) {
          derivedPillowTotal += Math.max(0, Number(rawDelta));
        } else if (rawSnapshot !== undefined && rawSnapshot !== null && Number.isFinite(Number(rawSnapshot))) {
          const current = Math.max(0, Number(rawSnapshot));
          if (previousLifetimePillows !== null) derivedPillowTotal += Math.max(0, current - previousLifetimePillows);
          previousLifetimePillows = current;
        } else if (/pillow produced/i.test(String(item.event || item.title || item.type || ''))) {
          derivedPillowTotal += 1;
        }
      });
      const containerTotal = Math.max(derivedContainerTotal, Number(productionSummary?.repellentContainerCount ?? productionSummary?.repellentContainersProcessed ?? 0));
      const pillowTotal = Math.max(derivedPillowTotal, Number(productionSummary?.lifetimePillowsProduced ?? productionSummary?.pillowsProduced ?? productionSummary?.pillowCount ?? 0));
      const hasContainerTotal = Boolean(hasContainerSummary || derivedContainerTotal > 0);
      const hasPillowTotal = Boolean(hasPillowSummary || derivedPillowTotal > 0);
      const buildLine = (total, fieldNames, eventRows, deltaFields, fallbackDelta, summaryTimestamp) => {
        // Build a point from each saved cumulative snapshot or per-event output.
        // Mixing both formats keeps newer snapshot records and older delta-only records visible.
        let running = 0;
        const points = eventRows.map(item => {
          const rawSnapshot = fieldNames.map(field => item[field]).find(value => value !== undefined && value !== null && Number.isFinite(Number(value)));
          const rawDelta = deltaFields.map(field => item[field]).find(value => value !== undefined && value !== null && Number.isFinite(Number(value)));
          let value;
          if (rawSnapshot !== undefined) {
            value = Number(rawSnapshot);
            running = Math.max(running, value);
          } else {
            const delta = rawDelta !== undefined ? Math.max(0, Number(rawDelta)) : Math.max(0, Number(fallbackDelta(item) || 0));
            if (delta <= 0) return null;
            running += delta;
            value = running;
          }
          return { value, createdAt: Number(item.createdAt) };
        }).filter(Boolean);
        // A summary may contain the live lifetime total even when older firmware did
        // not write individual production events. Show it as a clearly-labeled snapshot
        // rather than leaving a valid non-zero total with an empty chart.
        if (!points.length && Number(total) > 0) {
          const latestEventTime = eventRows.reduce((latest, item) => Math.max(latest, Number(item.createdAt) || 0), 0);
          points.push({ value: Number(total), createdAt: Number(summaryTimestamp) || latestEventTime || Date.now(), estimated: true });
        }
        const max = Math.max(4, Math.ceil(Math.max(total, ...points.map(p => p.value), 0) / 4) * 4);
        const coords = points.map((p,i) => ({x: points.length === 1 ? 50 : 4 + i * (92 / (points.length - 1)), y: 100 - (p.value / max) * 88, value:p.value, createdAt:p.createdAt, estimated:p.estimated}));
        // Use straight segments between measured counts; smoothing can create misleading overshoots.
        const path = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return {max, coords, path, total, hasSnapshots:eventRows.some(item => fieldNames.some(field => item[field] !== undefined && item[field] !== null && Number.isFinite(Number(item[field]))))};
      };
      const summaryTimestamp = productionSummary?.updatedAt ?? productionSummary?.createdAt ?? productionSummary?.timestamp;
      const containerLine = buildLine(containerTotal, ['repellentContainerCount', 'repellentContainersProcessed', 'containerCountAfter'], completedEvents, ['repellentContainerDelta','containerDelta'], item => 1, summaryTimestamp);
      // Plot only records that actually represent pillow output. Unrelated completed
      // repellent processes and interrupted processes may carry a zero snapshot and
      // must not create misleading zero markers on the pillow chart.
      const pillowHistoryEvents = [];
      let previousPillowSnapshot = null;
      allEvents.forEach(item => {
        const eventName = String(item.event || item.title || item.type || item.machineStatus || item.details || item.message || '').replace(/[_-]+/g, ' ').toLowerCase();
        if (/process interrupted/.test(eventName)) return;
        const rawDelta = item.pillowDelta ?? item.pillowsProducedDelta ?? item.pillowCountDelta;
        const rawSnapshot = item.lifetimePillowsProduced ?? item.pillowsProduced ?? item.pillowCount ?? item.pillowCountAfter;
        if (rawDelta !== undefined && rawDelta !== null && Number.isFinite(Number(rawDelta))) {
          if (Number(rawDelta) > 0) pillowHistoryEvents.push(item);
          return;
        }
        if (rawSnapshot !== undefined && rawSnapshot !== null && Number.isFinite(Number(rawSnapshot))) {
          const current = Math.max(0, Number(rawSnapshot));
          if ((previousPillowSnapshot === null && current > 0) || (previousPillowSnapshot !== null && current > previousPillowSnapshot)) {
            pillowHistoryEvents.push(item);
          }
          previousPillowSnapshot = current;
          return;
        }
        if (/pillow produced/.test(eventName)) pillowHistoryEvents.push(item);
      });
      const pillowLine = buildLine(pillowTotal, ['lifetimePillowsProduced','pillowsProduced','pillowCount','pillowCountAfter'], pillowHistoryEvents, ['pillowDelta','pillowsProducedDelta','pillowCountDelta'], item => /pillow produced/i.test(String(item.event || item.title || item.type || '')) ? 1 : 0, summaryTimestamp);
      const LineChart = ({data,color,label,hasData}) => <div className="line-chart-wrap">
        <div className="line-chart-y"><span>{data.max}</span><span>{Math.round(data.max*0.75)}</span><span>{Math.round(data.max*0.5)}</span><span>{Math.round(data.max*0.25)}</span><span>0</span></div>
        <div className="line-chart-plot">
          {[0,1,2,3,4].map(n=><div className="line-chart-gridline" key={n} style={{top:`${n*25}%`}}/>)}
          {hasData && data.coords.length > 0 ? <>
            <svg className="line-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${label}: total ${data.total}`}>
              {data.coords.length > 1 && <path d={data.path} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"/>}
            </svg>
            <div className="line-chart-markers" aria-hidden="true">{data.coords.map((p,i)=><span key={i} className="line-chart-marker" style={{left:`${p.x}%`,top:`${p.y}%`,backgroundColor:color}} title={`Count: ${p.value}`}/>)}</div>
          </> : <div className="chart-empty-state"><b>No {label.toLowerCase()} history yet</b><span>Complete a simulated process to record points for this line graph.</span></div>}
          <div className="line-chart-x"><span>{data.coords.length ? new Date(data.coords[0].createdAt).toLocaleDateString() : 'Start'}</span><span>{data.coords.length ? new Date(data.coords[data.coords.length-1].createdAt).toLocaleDateString() : 'Latest'}</span></div>
        </div>
      </div>;
      return <>
        <section className="panel production-chart-panel"><div className="panel-head"><div><h2>Pillows produced over time</h2><p>Pillow count by completed-process history</p></div></div>
          <div className="chart-legend"><span><i className="legend-pillows"/> Pillows produced <small>(count)</small></span></div>
          <LineChart data={pillowLine} color="#5c93d6" label="Pillows" hasData={Boolean(hasPillowTotal && pillowLine.coords.length > 0)}/>
          <div className="chart-footnote"><Radio size={14}/> Current total: {hasPillowTotal ? pillowTotal : '—'} pillows. Only recorded cumulative count snapshots are plotted; older history remains in the table.</div>
        </section>
      </>;
    })()}
    {(() => {
      const relevantHistory = activeHistory.filter(item => {
        const eventText = String(item.event || item.title || item.type || '').toLowerCase().replace(/[_-]+/g, ' ');
        const detailText = String(item.machineStatus || item.details || item.message || '').toLowerCase().replace(/[_-]+/g, ' ');
        return /process completed|process interrupted|pillow produced|repellent container/.test(eventText) || /process completed|process interrupted|pillow produced|repellent container/.test(detailText);
      });
      return <section className="panel history-panel"><div className="panel-head"><div><h2>Production event history</h2><p>Date and time for completed, interrupted, and recorded product-output events</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Event</th><th>Date</th><th>Time</th><th>Details</th></tr></thead><tbody>{relevantHistory.length ? relevantHistory.map(item => <tr key={item.id}><td>{formatEventLabel(item.event || item.title || item.type || 'Production event')}</td><td>{item.createdAt ? new Date(Number(item.createdAt)).toLocaleDateString() : '—'}</td><td>{item.createdAt ? new Date(Number(item.createdAt)).toLocaleTimeString() : '—'}</td><td>{item.machineStatus || item.details || item.message || (item.demoMode ? 'Demo record' : 'Firebase record')}</td></tr>) : <tr><td colSpan="4" className="empty-cell"><History size={23}/><b>No completed or interrupted processes yet</b><span>Only process completion and interruption events will appear here.</span></td></tr>}</tbody></table></div>
        <div className="chart-footnote"><Radio size={14}/> Completed, interrupted, and product-output records are shown here; timestamps come from Firebase history.</div>
      </section>;
    })()}
  </>;
}
function Alerts({filter,setFilter,notificationData}) {
  const notifications = notificationData.map(item => ({...item, title:item.title || item.event || item.type || 'Machine notification', detail:item.detail || item.message || item.machineStatus || 'Notification received from Firebase', time:item.createdAt ? new Date(Number(item.createdAt)).toLocaleString() : 'Time unavailable', category:item.category || item.type || 'All notifications', tone:'green', icon:Bell}));
  const [showRead, setShowRead] = useState(true);
  const unreadCount = notificationData.filter(item => item.read !== true).length;
  const visibleNotifications = notifications.filter(item => (filter === 'All notifications' || item.category === filter) && (showRead || item.read !== true));
  const markRead = async (item) => { try { await update(ref(database, `notifications/${item.id}`), { read: true, readAt: Date.now() }); } catch (error) { console.error('Unable to mark notification as read', error); } };
  const deleteRead = async (item) => { try { await remove(ref(database, `notifications/${item.id}`)); } catch (error) { console.error('Unable to delete notification', error); } };
  const markAllRead = async () => { try { await Promise.all(notificationData.filter(item => item.read !== true).map(item => update(ref(database, `notifications/${item.id}`), { read: true, readAt: Date.now() }))); } catch (error) { console.error('Unable to mark notifications as read', error); } };
  return <><PageHeading eyebrow="NOTIFICATION CENTER" title="Notifications" subtitle="Notifications appear here only when cotton is empty, a process completes, or a process is interrupted." />
    <section className="panel"><div className="panel-head"><div><h2>Notifications <span className="unread-summary">{unreadCount} unread</span></h2><p>Machine events that need your attention</p></div><div className="notification-page-actions"><label className="show-read-toggle"><input type="checkbox" checked={showRead} onChange={e=>setShowRead(e.target.checked)}/> Show read</label>{unreadCount > 0 && <button className="mark-all-page" onClick={markAllRead}>Mark all as read</button>}<select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter notifications"><option>All notifications</option><option>Cotton is empty</option><option>Process completed</option><option>Process interrupted</option></select></div></div>
      {visibleNotifications.length === 0 ? <div className="empty-cell notification-empty"><Bell size={24}/><b>No notifications yet</b><span>When cotton is empty, a process completes, or a process is interrupted, the notification will appear here.</span></div> : <div className="event-list">{visibleNotifications.map((item)=><div className={'event-row '+(item.read === true ? 'event-read' : 'event-unread')} key={item.id}><div className={'event-icon '+item.tone}><item.icon size={17}/></div><div className="event-copy"><b>{item.title}</b><small>{item.detail}</small><span className="read-state">{item.read === true ? 'Read' : 'Unread'}</span></div><span className="event-time">{item.time}</span>{item.read !== true && <button className="mark-read-button" onClick={() => markRead(item)}>Mark as read</button>}<button className="mark-read-button" onClick={() => deleteRead(item)}>Delete</button></div>)}</div>}
    </section>
  </>;
}
function SettingsPage({inform, machineData, firebaseStatus}) {
  const [saved,setSaved] = useState(false);
  const save = () => {
    setSaved(true);
    inform('Notification preferences saved for this browser session only. Firebase persistence is not configured yet.');
  };
  return <><PageHeading eyebrow="CONFIGURATION" title="Settings" subtitle="Configure notification preferences and review system connection information."/>
    <div className="settings-grid">
      <section className="panel about-panel"><div className="panel-head"><div><h2>About</h2><p>Project information</p></div><div className="settings-icon"><Leaf size={18}/></div></div>
        <div className="about-brand"><div className="about-logo"><Leaf size={24}/></div><div><b>BUBOSOFT SHIELD</b><span>Smart Kapok Fiber Processing &amp; Pillow Filling System</span></div></div>
        <p className="about-description">A machine monitoring interface for a Buboi fiber processing workflow, repellent liquid preparation, and pillow filling production.</p>
        <div className="about-features"><span><CheckCircle2 size={14}/> Production stage monitoring</span><span><CheckCircle2 size={14}/> Cotton and liquid sensor status</span><span><CheckCircle2 size={14}/> Production history and notifications</span></div>
        <div className="about-meta"><ConfigRow label="Interface version" value="Build 0.2.0"/><ConfigRow label="Operating mode" value="Monitoring only"/><ConfigRow label="Firebase connection" value={firebaseStatus === 'Connected' ? (machineData ? 'Connected · live machine data received' : 'Connected · waiting for machine data') : firebaseStatus}/></div>
        <div className="sensor-note"><Radio size={16}/> Live machine readings and event history are shown here when records are available in Firebase.</div>
      </section>
      <section className="panel"><div className="panel-head"><div><h2>System connection</h2><p>Connection details for the monitoring app</p></div><div className="settings-icon"><SlidersHorizontal size={17}/></div></div>
        <ConfigRow label="Frontend hosting" value="Vercel"/>
        <ConfigRow label="Source control" value="GitHub"/>
        <ConfigRow label="Database" value={`Firebase · ${firebaseStatus.toLowerCase()}`}/>
        <ConfigRow label="Machine controller" value="Arduino Mega 2560"/>
        <ConfigRow label="Network controller" value={machineData ? 'ESP32 · data received' : 'ESP32 · waiting for data'}/>
        <ConfigRow label="Last data received" value={machineData?.receivedAt ? new Date(Number(machineData.receivedAt)).toLocaleString() : 'No timestamp yet'}/>
        <div className="sensor-note"><ShieldCheck size={16}/> This dashboard displays machine data only. Start/stop controls and safety interlocks must remain on the Nextion HMI and machine controller.</div>
      </section>


    </div>
  </>;
}
function ConfigRow({label,value}) { return <div className="config-row"><span>{label}</span><b>{value}</b></div>; }
function Stat({icon: Icon, tone, label, value, meta, tag}) { return <div className="stat"><div className="stat-top"><div className={'stat-icon '+tone}><Icon size={20}/></div><span className="tag">{tag}</span></div><small>{label}</small><b className="stat-value">{value}</b><p>{meta}</p></div>; }
function Sensor({name,desc,icon:Icon,warn}) { return <div className="sensor"><div className="sensor-icon"><Icon size={17}/></div><div className="sensor-copy"><b>{name}</b><small>{desc}</small></div><span className={warn?'warn':'no-data'}><i/>{warn?'Offline':'No data'}</span></div>; }
