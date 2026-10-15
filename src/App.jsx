import React, { useEffect, useState } from 'react';
import { onValue, ref, update } from 'firebase/database';
import { database } from './firebase';
import { Activity, Bell, CalendarDays, CheckCircle2, ChevronDown, Circle, CircleAlert, ClipboardList, Clock3, Cpu, Download, Droplets, Filter, Home, Layers3, Leaf, Menu, Package, Play, RefreshCw, Search, Settings, ShieldCheck, SlidersHorizontal, Wifi, ArrowUpRight, Gauge, X, Radio, History, AlertTriangle, RotateCcw } from 'lucide-react';

const navigation = [['Dashboard', Home], ['Live Monitoring', Activity], ['Production History', ClipboardList], ['Notifications', Bell], ['Settings', Settings]];
const stages = [['Dehusking', 'Fiber preparation'], ['Separation', 'Separate fiber and shell'], ['Liquid extraction', 'Prepare repellent extract'], ['Repellent mixing', 'Mix liquid ingredients'], ['Cotton filling', 'Pillow filling cycle']];
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
  const markNotificationRead = async (item) => { try { await import('firebase/database').then(({ remove }) => remove(ref(database, `notifications/${item.id}`))); } catch (error) { inform('Could not delete notification. Check Firebase database rules.'); } };
  const markAllNotificationsRead = async () => { try { const { remove } = await import('firebase/database'); await Promise.all(notificationData.filter(item => item.read !== true).map(item => remove(ref(database, `notifications/${item.id}`)))); inform('All unread notifications deleted.'); } catch (error) { inform('Could not delete notifications. Check Firebase database rules.'); } };
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
              {notificationData.length === 0 ? <div className="notification-popover-empty"><Bell size={20}/><span>No notifications yet</span></div> : <div className="notification-popover-list">{notificationData.slice(0,5).map(item => <div className={'notification-popover-item ' + (item.read === true ? 'is-read' : 'is-unread')} key={item.id}><button className="notification-popover-item-main" onClick={() => { if (item.read !== true) markNotificationRead(item); setNotificationMenuOpen(false); go('Notifications'); }}><span className="notification-popover-icon"><Bell size={15}/></span><span className="notification-popover-copy"><b>{item.title || item.event || item.type || 'Machine notification'}</b><small>{item.detail || item.message || item.machineStatus || 'Notification received from Firebase'}</small><em>{item.createdAt ? new Date(Number(item.createdAt)).toLocaleString() : 'Time unavailable'}</em></span></button>{item.read !== true && <button className="notification-mark-read" aria-label="Mark notification as read" title="Mark as read" onClick={() => markNotificationRead(item)}>Mark read</button>}</div>)}</div>}
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
  const cottonReady = sensors.middleCottonLaser === true || sensors.bottomCottonLaser === true;
  const liquidLabel = !hasLiquidData ? 'No data' : sensors.fullLiquidSensor ? 'Full' : sensors.halfLiquidSensor ? 'At least half' : 'Low / empty';
  const machineLabel = machineData?.status || 'Waiting for data';
  return <><PageHeading title="Good day, Operator" subtitle="Monitor your kapok processing and repellent production system." />
    <SectionTitle title="System overview" subtitle="Live indicators from Firebase" right={<span className="sample"><i/> {firebaseStatus === 'Connected' && machineData ? (machineData.demoMode ? 'DEMO DATA' : 'LIVE FIREBASE DATA') : firebaseStatus.toUpperCase()}</span>}/>
    <div className="stats"><Stat icon={Cpu} tone="green" label="Machine status" value={machineLabel} meta={machineData ? (machineData.demoMode ? 'Simulated ESP32 reading' : 'Latest controller reading') : 'Waiting for machine/latest'} tag={machineData ? 'RECEIVING' : 'NO DATA'}/><Stat icon={Layers3} tone="blue" label="Current process" value={machineData?.currentProcess || 'Not reported'} meta={machineData?.processStage || 'No active stage reported'} tag={machineData?.currentProcess ? 'ACTIVE' : 'UNKNOWN'}/><Stat icon={Package} tone="orange" label="Cotton supply" value={!hasCottonData ? 'No data' : cottonReady ? 'Cotton detected' : 'Insufficient cotton'} meta={`Middle: ${sensors.middleCottonLaser === undefined ? '—' : sensors.middleCottonLaser} · Bottom: ${sensors.bottomCottonLaser === undefined ? '—' : sensors.bottomCottonLaser}`} tag={hasCottonData ? (cottonReady ? 'READY' : 'CHECK') : 'NO DATA'}/><Stat icon={Droplets} tone="purple" label="Liquid system" value={liquidLabel} meta={`Half: ${sensors.halfLiquidSensor === undefined ? '—' : sensors.halfLiquidSensor} · Full: ${sensors.fullLiquidSensor === undefined ? '—' : sensors.fullLiquidSensor}`} tag={hasLiquidData ? 'SENSOR DATA' : 'NO DATA'}/></div>
    <div className="columns single-panel"><section className="panel"><div className="panel-head"><div><h2>Production process</h2><p>Track the full production workflow</p></div><button className="link" onClick={() => go('Live Monitoring')}>View details <ArrowUpRight size={15}/></button></div><div className="process-summary"><div className="sumicon"><Activity/></div><div><b>{machineData?.currentProcess || 'No active batch reported'}</b><small>{machineData?.processStage || 'Detailed process-stage data has not been sent by the ESP32 yet.'}</small></div><span>{machineData ? 'CONNECTED' : 'STANDBY'}</span></div>{stages.map(([name, desc], index) => { const active = machineData?.currentProcess === name || machineData?.processStage === name; const completed = Number(machineData?.completedStageIndex || 0) > index || machineData?.lastEventType === 'process_completed'; const interrupted = machineData?.lastEventType === 'process_interrupted' && (active || machineData?.currentProcess === 'Interrupted'); const label = interrupted ? 'Interrupted' : active ? 'Running' : completed ? 'Completed' : machineData?.currentProcess === 'Standby' ? 'Standby' : 'Waiting for stage'; return <div className={'stage ' + (active ? 'stage-active' : completed ? 'stage-complete' : interrupted ? 'stage-interrupted' : '')} key={name}><div className="stage-icon"><Circle size={17}/></div><div className="stage-name"><b>{name}</b><small>{desc}</small></div><span>{label}</span><em>{active ? '●' : completed ? '✓' : interrupted ? '!' : '—'}</em></div>; })}<div className="panel-foot"><span><Clock3 size={15}/> Stage durations not available</span><button onClick={() => go('Production History')}>View batch history ↗</button></div></section>
    </div>
    <div className="columns bottom single-panel"><section className="panel"><div className="panel-head"><div><h2>Production summary</h2><p>Batch overview for selected period</p></div><select aria-label="Production period" value={period} onChange={e=>setPeriod(e.target.value)}><option>Today</option><option>This week</option><option>This month</option></select></div><div className="metrics summary-metrics">{[['Repellent containers processed',productionSummary?.repellentContainerCount ?? productionSummary?.repellentContainersProcessed ?? '—'],['Pillows produced',productionSummary?.pillowsProduced ?? productionSummary?.pillowCount ?? pillowCount]].map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b><em>{productionSummary ? 'Summary received from Firebase' : 'No production summary reported yet'}</em></div>)}</div><div className="empty"><Activity/><b>{productionHistory.length ? productionHistory.length + ' recorded history events' : 'No production history yet'}</b><small>Records received from production/history appear here.</small><button className="link" onClick={() => go('Production History')}>Open production history <ArrowUpRight size={15}/></button></div></section>
    </div>
  </>;
}
function LiveMonitoring({inform, machineData, firebaseStatus}) {
  return <><PageHeading eyebrow="MACHINE TELEMETRY" title="Live Monitoring" subtitle="Review configured sensor inputs and machine process states." />
    <div className="notice"><Radio size={17}/><span>{machineData ? (machineData.demoMode ? 'Firebase connected. These are simulated demo readings, not physical sensor measurements.' : 'Firebase connected. Displaying the latest values received from the machine.') : 'Waiting for data at machine/latest in Firebase.'}</span></div>
    <section className="panel stage-panel"><div className="panel-head"><div><h2>Process stage monitor</h2><p>Monitor each production stage reported by the machine.</p></div><span className="monitor-count"><Activity size={14}/> 5 production stages</span></div><div className="stage-grid">{stages.map(([name, desc], index)=>{const active = machineData?.currentProcess === name || machineData?.processStage === name; const completed = Number(machineData?.completedStageIndex || 0) > index || machineData?.lastEventType === 'process_completed'; const interrupted = machineData?.lastEventType === 'process_interrupted' && machineData?.currentProcess === 'Interrupted'; const label = interrupted ? 'Interrupted' : active ? 'Running now' : completed ? 'Completed' : machineData?.currentProcess === 'Standby' ? 'Standby' : 'Waiting for stage'; return <div className={'stage-card '+(active?'stage-card-active':completed?'stage-card-complete':interrupted?'stage-card-interrupted':'')} key={name}><div className="stage-card-top"><div className="stage-card-icon"><Circle size={18}/></div><span className="stage-number">{String(index+1).padStart(2,"0")}</span></div><b>{name}</b><small>{desc}</small><span className="stage-waiting"><i/> {label}</span></div>;})}</div><div className="monitor-note"><div className="monitor-note-icon"><Radio size={17}/></div><div><b>Simulation-aware monitoring</b><p>Stage cards now read currentProcess, processStage, completedStageIndex, and event status from Firebase. The ESP32 simulation must send a matching stage name for a stage to show Running.</p></div></div></section>
    <section className="panel"><div className="panel-head"><div><h2>Sensor inputs</h2><p>Pin references from the current project plan</p></div><span className="sample"><i/> {firebaseStatus.toUpperCase()}</span></div><div className="table-wrap"><table><thead><tr><th>Sensor</th><th>Purpose</th><th>Current value</th><th>Status</th></tr></thead><tbody>{[['middleCottonLaser','Middle cotton laser','Cotton presence'],['bottomCottonLaser','Bottom cotton laser','Cotton presence'],['halfLiquidSensor','Half liquid sensor','Liquid level threshold'],['fullLiquidSensor','Full liquid sensor','Liquid level threshold']].map(([key,name,purpose])=>{const value=machineData?.sensors?.[key]; return <tr key={key}><td>{name}</td><td>{purpose}</td><td>{value === undefined || value === null ? '—' : String(value)}</td><td><span className={'pill '+(value === undefined || value === null ? 'muted' : 'good')}>{value === undefined || value === null ? 'No data' : 'Live'}</span></td></tr>;})}</tbody></table></div></section>
  </>;
}
function ProductionHistory({period,setPeriod,productionSummary,productionHistory,productionReportRange,setProductionReportRange}) {
  const labels = period === 'This week' ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] : period === 'This month' ? ['Week 1','Week 2','Week 3','Week 4'] : period === 'This year' ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] : ['Today'];
  const periods = <select value={period} onChange={e=>setPeriod(e.target.value)} aria-label="Chart date range"><option>Today</option><option>This week</option><option>This month</option><option>This year</option></select>;
  return <><PageHeading eyebrow="PRODUCTION ANALYTICS" title="Production History" subtitle="Track repellent containers processed, completed pillows, and production events over time." />
    <div className="stats"><Stat icon={Droplets} tone="green" label="Overall repellent containers" value={productionSummary?.repellentContainerCount ?? productionSummary?.repellentContainersProcessed ?? '—'} meta="Lifetime total saved in Firebase" tag={productionSummary ? 'RECORDED' : 'EMPTY'}/><Stat icon={Package} tone="blue" label="Overall pillows produced" value={productionSummary?.pillowsProduced ?? productionSummary?.pillowCount ?? '—'} meta="Lifetime total saved in Firebase" tag={productionSummary ? 'RECORDED' : 'EMPTY'}/><Stat icon={CheckCircle2} tone="purple" label="History events" value={productionHistory.length} meta="Records from production/history" tag={productionHistory.length ? 'RECORDED' : 'EMPTY'}/><Stat icon={AlertTriangle} tone="orange" label="Demo records" value={productionHistory.filter(x => x.demoMode || /demo/i.test(x.event || '')).length} meta="Simulated records if present" tag="INFO"/></div>
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
      const all = [...productionHistory].filter(item => item.createdAt).sort((a,b) => Number(a.createdAt)-Number(b.createdAt));
      let previousContainers = null;
      let previousPillows = null;
      let containers = 0;
      let pillows = 0;
      let knownContainerEvents = 0;
      let knownPillowEvents = 0;
      all.forEach(item => {
        const timestamp = Number(item.createdAt);
        const inRange = timestamp >= start.getTime() && timestamp <= end.getTime();
        const rawContainers = item.repellentContainerCount ?? item.repellentContainersProcessed ?? item.containerCountAfter;
        const rawPillows = item.pillowsProduced ?? item.pillowCount ?? item.pillowCountAfter;
        const currentContainers = rawContainers !== undefined && rawContainers !== null && Number.isFinite(Number(rawContainers)) ? Number(rawContainers) : null;
        const currentPillows = rawPillows !== undefined && rawPillows !== null && Number.isFinite(Number(rawPillows)) ? Number(rawPillows) : null;

        // Prefer explicit per-event output deltas when available. This avoids guessing
        // which product completed when both lifetime counters are stored in a snapshot.
        const explicitContainerDelta = item.repellentContainerDelta ?? item.containerDelta;
        const explicitPillowDelta = item.pillowDelta ?? item.pillowsProducedDelta ?? item.pillowCountDelta;
        if (explicitContainerDelta !== undefined && explicitContainerDelta !== null && Number.isFinite(Number(explicitContainerDelta))) {
          const delta = Math.max(0, Number(explicitContainerDelta));
          if (inRange) { containers += delta; if (delta > 0) knownContainerEvents++; }
        } else if (currentContainers !== null) {
          const delta = previousContainers === null ? 0 : Math.max(0, currentContainers - previousContainers);
          if (inRange) { containers += delta; if (delta > 0) knownContainerEvents++; }
        }
        if (explicitPillowDelta !== undefined && explicitPillowDelta !== null && Number.isFinite(Number(explicitPillowDelta))) {
          const delta = Math.max(0, Number(explicitPillowDelta));
          if (inRange) { pillows += delta; if (delta > 0) knownPillowEvents++; }
        } else if (currentPillows !== null) {
          const delta = previousPillows === null ? 0 : Math.max(0, currentPillows - previousPillows);
          if (inRange) { pillows += delta; if (delta > 0) knownPillowEvents++; }
        }
        if (currentContainers !== null) previousContainers = currentContainers;
        if (currentPillows !== null) previousPillows = currentPillows;
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
        <div className="chart-footnote"><Radio size={14}/> Period totals use saved cumulative count snapshots. Older records without snapshots cannot be counted accurately.</div>
      </section>;
    })()}
    {(() => {
      const completedEvents = [...productionHistory]
        .filter(item => /process completed/i.test(String(item.event || item.title || '')) && item.createdAt)
        .sort((a,b) => Number(a.createdAt) - Number(b.createdAt));
      const hasContainerTotal = productionSummary && (productionSummary.repellentContainerCount !== undefined || productionSummary.repellentContainersProcessed !== undefined);
      const hasPillowTotal = productionSummary && (productionSummary.pillowsProduced !== undefined || productionSummary.pillowCount !== undefined);
      const containerTotal = Number(productionSummary?.repellentContainerCount ?? productionSummary?.repellentContainersProcessed ?? 0);
      const pillowTotal = Number(productionSummary?.pillowsProduced ?? productionSummary?.pillowCount ?? 0);
      const buildLine = (total, fieldNames) => {
        // Use only events with saved cumulative snapshots when available. Older events
        // remain in the table but cannot be plotted as exact historical count values.
        const snapshots = completedEvents.map(item => {
          for (const field of fieldNames) {
            const raw = item[field];
            if (raw !== undefined && raw !== null && Number.isFinite(Number(raw))) {
              return { value: Number(raw), createdAt: Number(item.createdAt) };
            }
          }
          return null;
        }).filter(Boolean);
        const points = snapshots;
        const max = Math.max(4, Math.ceil(Math.max(total, ...points.map(p => p.value), 0) / 4) * 4);
        const coords = points.map((p,i) => ({x: points.length === 1 ? 50 : 4 + i * (92 / (points.length - 1)), y: 100 - (p.value / max) * 88, value:p.value, createdAt:p.createdAt, estimated:p.estimated}));
        // Use straight segments between measured counts; smoothing can create misleading overshoots.
        const path = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return {max, coords, path, total, hasSnapshots:snapshots.length > 0};
      };
      const containerLine = buildLine(containerTotal, ['repellentContainerCount', 'repellentContainersProcessed', 'containerCountAfter']);
      const pillowLine = buildLine(pillowTotal, ['pillowsProduced', 'pillowCount', 'pillowCountAfter']);
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
        <section className="panel production-chart-panel"><div className="panel-head"><div><h2>Repellent containers over time</h2><p>Container count by completed-process history</p></div></div>
          <div className="chart-legend"><span><i className="legend-repellent"/> Containers processed <small>(count)</small></span></div>
          <LineChart data={containerLine} color="#2d9660" label="Repellent containers" hasData={Boolean(hasContainerTotal && containerLine.hasSnapshots)}/>
          <div className="chart-footnote"><Radio size={14}/> Current total: {hasContainerTotal ? containerTotal : '—'} containers. Only events with saved cumulative count snapshots are plotted; older history remains in the table.</div>
        </section>
        <section className="panel production-chart-panel"><div className="panel-head"><div><h2>Pillows produced over time</h2><p>Pillow count by completed-process history</p></div></div>
          <div className="chart-legend"><span><i className="legend-pillows"/> Pillows produced <small>(count)</small></span></div>
          <LineChart data={pillowLine} color="#5c93d6" label="Pillows" hasData={Boolean(hasPillowTotal && pillowLine.hasSnapshots)}/>
          <div className="chart-footnote"><Radio size={14}/> Current total: {hasPillowTotal ? pillowTotal : '—'} pillows. Only recorded cumulative count snapshots are plotted; older history remains in the table.</div>
        </section>
      </>;
    })()}
    <section className="panel history-panel"><div className="panel-head"><div><h2>Completed & interrupted history</h2><p>Date and time for each production event, recorded by the machine</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Event</th><th>Date</th><th>Time</th><th>Details</th></tr></thead><tbody>{productionHistory.length ? productionHistory.map(item => <tr key={item.id}><td>{item.event || item.type || 'Machine event'}</td><td>{item.createdAt ? new Date(Number(item.createdAt)).toLocaleDateString() : '—'}</td><td>{item.createdAt ? new Date(Number(item.createdAt)).toLocaleTimeString() : '—'}</td><td>{item.machineStatus || item.details || (item.demoMode ? 'Demo record' : 'Firebase record')}</td></tr>) : <tr><td colSpan="4" className="empty-cell"><History size={23}/><b>No production events yet</b><span>New records will appear when written to production/history.</span></td></tr>}</tbody></table></div>
      <div className="chart-footnote"><Radio size={14}/> Event timestamps will come from recorded controller events; no dates or times are fabricated.</div>
    </section>
  </>;
}
function Alerts({filter,setFilter,notificationData}) {
  const notifications = notificationData.map(item => ({...item, title:item.title || item.event || item.type || 'Machine notification', detail:item.detail || item.message || item.machineStatus || 'Notification received from Firebase', time:item.createdAt ? new Date(Number(item.createdAt)).toLocaleString() : 'Time unavailable', category:item.category || item.type || 'All notifications', tone:'green', icon:Bell}));
  const [showRead, setShowRead] = useState(true);
  const unreadCount = notificationData.filter(item => item.read !== true).length;
  const visibleNotifications = notifications.filter(item => (filter === 'All notifications' || item.category === filter) && (showRead || item.read !== true));
  const markRead = async (item) => { try { const { remove } = await import('firebase/database'); await remove(ref(database, `notifications/${item.id}`)); } catch (error) { console.error('Unable to delete notification', error); } };
  const markAllRead = async () => { try { const { remove } = await import('firebase/database'); await Promise.all(notificationData.filter(item => item.read !== true).map(item => remove(ref(database, `notifications/${item.id}`)))); } catch (error) { console.error('Unable to delete notifications', error); } };
  return <><PageHeading eyebrow="NOTIFICATION CENTER" title="Notifications" subtitle="Notifications appear here only when cotton is empty, a process completes, or a process is interrupted." />
    <section className="panel"><div className="panel-head"><div><h2>Notifications <span className="unread-summary">{unreadCount} unread</span></h2><p>Machine events that need your attention</p></div><div className="notification-page-actions"><label className="show-read-toggle"><input type="checkbox" checked={showRead} onChange={e=>setShowRead(e.target.checked)}/> Show read</label>{unreadCount > 0 && <button className="mark-all-page" onClick={markAllRead}>Mark all as read</button>}<select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter notifications"><option>All notifications</option><option>Cotton is empty</option><option>Process completed</option><option>Process interrupted</option></select></div></div>
      {visibleNotifications.length === 0 ? <div className="empty-cell notification-empty"><Bell size={24}/><b>No notifications yet</b><span>When cotton is empty, a process completes, or a process is interrupted, the notification will appear here.</span></div> : <div className="event-list">{visibleNotifications.map((item)=><div className={'event-row '+(item.read === true ? 'event-read' : 'event-unread')} key={item.id}><div className={'event-icon '+item.tone}><item.icon size={17}/></div><div className="event-copy"><b>{item.title}</b><small>{item.detail}</small><span className="read-state">{item.read === true ? 'Read' : 'Unread'}</span></div><span className="event-time">{item.time}</span>{item.read !== true && <button className="mark-read-button" onClick={() => markRead(item)}>Mark as read</button>}</div>)}</div>}
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
        <p className="about-description">A machine monitoring interface for a kapok fiber processing workflow, repellent liquid preparation, and pillow filling production.</p>
        <div className="about-features"><span><CheckCircle2 size={14}/> Production stage monitoring</span><span><CheckCircle2 size={14}/> Cotton and liquid sensor status</span><span><CheckCircle2 size={14}/> Production history and notifications</span></div>
        <div className="about-meta"><ConfigRow label="Interface version" value="Preview build 0.2.0"/><ConfigRow label="Operating mode" value="Monitoring only"/><ConfigRow label="Data integration" value="Firebase setup pending"/></div>
        <div className="sensor-note"><Radio size={16}/> Readings and event history will become available after the machine controller and Firebase are connected.</div>
      </section>
      <section className="panel"><div className="panel-head"><div><h2>System connection</h2><p>Connection details for the monitoring app</p></div><div className="settings-icon"><SlidersHorizontal size={17}/></div></div>
        <ConfigRow label="Frontend hosting" value="Vercel"/>
        <ConfigRow label="Source control" value="GitHub"/>
        <ConfigRow label="Database" value={`Firebase · ${firebaseStatus.toLowerCase()}`}/>
        <ConfigRow label="Machine controller" value="Arduino Mega 2560"/>
        <ConfigRow label="Network controller" value={machineData ? 'ESP32 · data received' : 'ESP32 · waiting for data'}/>
        <ConfigRow label="Last data received" value={machineData?.receivedAt ? new Date(Number(machineData.receivedAt)).toLocaleString() : 'No timestamp yet'}/>
        <div className="sensor-note"><ShieldCheck size={16}/> The web app is monitoring-only. Machine operation and safety interlocks remain on the Nextion HMI and controller.</div>
      </section>


    </div>
  </>;
}
function ConfigRow({label,value}) { return <div className="config-row"><span>{label}</span><b>{value}</b></div>; }
function Stat({icon: Icon, tone, label, value, meta, tag}) { return <div className="stat"><div className="stat-top"><div className={'stat-icon '+tone}><Icon size={20}/></div><span className="tag">{tag}</span></div><small>{label}</small><b className="stat-value">{value}</b><p>{meta}</p></div>; }
function Sensor({name,desc,icon:Icon,warn}) { return <div className="sensor"><div className="sensor-icon"><Icon size={17}/></div><div className="sensor-copy"><b>{name}</b><small>{desc}</small></div><span className={warn?'warn':'no-data'}><i/>{warn?'Offline':'No data'}</span></div>; }
