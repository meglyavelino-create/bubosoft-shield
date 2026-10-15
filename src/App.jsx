import React, { useState } from 'react';
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
  const go = (name) => { setPage(name); setMenu(false); setNotice(''); };
  const inform = (message) => setNotice(message);
  const refresh = () => { setRefreshCount(v => v + 1); inform('Demo data refreshed. Live readings will appear after Firebase and controller integration.'); };
  return <div className="app">
    <aside className={'sidebar ' + (menu ? 'open' : '')}>
      <div className="brand"><div className="logo"><Leaf size={23}/></div><div><b>BUBOSOFT</b><small>SHIELD · MACHINE SYSTEM</small></div></div>
      <label>WORKSPACE</label>
      {navigation.map(([name, Icon]) => <button key={name} className={'nav ' + (page === name ? 'selected' : '')} onClick={() => go(name)}><Icon size={18}/>{name}{name === 'Alerts & Logs' && <i className="nav-dot"/>}</button>)}
      <div className="side-bottom"><div className="help"><ShieldCheck/><div><b>Machine workspace</b><small>Monitoring prototype</small></div></div><div className="user"><div className="avatar">BS</div><div><b>System Operator</b><small>Preview account</small></div><ChevronDown size={16}/></div></div>
    </aside>
    {menu && <button className="scrim" aria-label="Close menu" onClick={() => setMenu(false)}/>}
    <main><header><div className="crumb"><button className="hamb" onClick={() => setMenu(!menu)} aria-label="Toggle menu"><Menu/></button>Workspace <span>/</span> <b>{page}</b></div><div className="topright"><span className="demo"><i/> Demo mode</span><button className="bell" aria-label="Notifications" onClick={() => go('Notifications')}><Bell size={18}/></button><span className="date"><CalendarDays size={16}/> Machine overview</span></div></header>
      <div className="content">
        {notice && <div className="notice"><CircleAlert size={17}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}
        {page === 'Dashboard' && <Dashboard go={go} inform={inform} refresh={refresh} period={period} setPeriod={setPeriod} refreshCount={refreshCount} pillowCount={pillowCount}/>}
        {page === 'Live Monitoring' && <LiveMonitoring inform={inform}/>}
        {page === 'Production History' && <ProductionHistory query={query} setQuery={setQuery} period={period} setPeriod={setPeriod}/>}
        {page === 'Notifications' && <Alerts filter={filter} setFilter={setFilter}/>}
        {page === 'Settings' && <SettingsPage inform={inform}/>}
        <footer>© 2026 BUBOSOFT SHIELD <span><ShieldCheck size={14}/> Machine monitoring interface · Preview build 0.2.0</span></footer>
      </div></main></div>;
}
function PageHeading({eyebrow='SMART MACHINE MONITORING', title, subtitle, children}) { return <div className="welcome"><div><div className="eyebrow"><i/> {eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{children && <div className="actions">{children}</div>}</div>; }
function SectionTitle({title, subtitle, right}) { return <div className="section-title"><div><h2>{title}</h2><p>{subtitle}</p></div>{right}</div>; }
function Dashboard({go, inform, refresh, period, setPeriod, refreshCount, pillowCount}) {
  return <><PageHeading title="Good day, Operator" subtitle="Monitor your kapok processing and repellent production system." />
    <SectionTitle title="System overview" subtitle="Key indicators from your machine" right={<span className="sample"><i/> SAMPLE DATA · NOT CONNECTED</span>}/>
    <div className="stats"><Stat icon={Cpu} tone="green" label="Machine status" value="Standby" meta="Awaiting process start" tag="IDLE"/><Stat icon={Layers3} tone="blue" label="Current process" value="Not running" meta="No active production stage" tag="READY"/><Stat icon={Package} tone="orange" label="Cotton supply" value="Unverified" meta="Sensor data not connected" tag="NO DATA"/><Stat icon={Droplets} tone="purple" label="Liquid system" value="Standby" meta="Level sensors not connected" tag="IDLE"/></div>
    <div className="columns single-panel"><section className="panel"><div className="panel-head"><div><h2>Production process</h2><p>Track the full production workflow</p></div><button className="link" onClick={() => go('Live Monitoring')}>View details <ArrowUpRight size={15}/></button></div><div className="process-summary"><div className="sumicon"><Activity/></div><div><b>No active batch</b><small>Production stages will update when machine telemetry is connected.</small></div><span>STANDBY</span></div>{stages.map(([name, desc]) => <div className="stage" key={name}><div className="stage-icon"><Circle size={17}/></div><div className="stage-name"><b>{name}</b><small>{desc}</small></div><span>Waiting</span><em>—</em></div>)}<div className="panel-foot"><span><Clock3 size={15}/> Stage durations not available</span><button onClick={() => go('Production History')}>View batch history ↗</button></div></section>
    </div>
    <div className="columns bottom single-panel"><section className="panel"><div className="panel-head"><div><h2>Production summary</h2><p>Batch overview for selected period</p></div><select aria-label="Production period" value={period} onChange={e=>setPeriod(e.target.value)}><option>Today</option><option>This week</option><option>This month</option></select></div><div className="metrics summary-metrics">{[['Repellent produced','—'],['Pillows produced',String(pillowCount)]].map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b><em>{label === 'Pillows produced' ? 'Waiting for device data' : 'Amount recorded after device integration'}</em></div>)}</div><div className="empty"><Activity/><b>{pillowCount ? `${pillowCount} pillows produced` : 'Pillow count will appear here'}</b><small>Pillow count will update when machine data is connected to the app.</small></div></section>
    </div>
  </>;
}
function LiveMonitoring({inform}) {
  return <><PageHeading eyebrow="MACHINE TELEMETRY" title="Live Monitoring" subtitle="Review configured sensor inputs and machine process states." />
    <div className="notice"><Radio size={17}/><span><b>Demo mode:</b> values are not being read from physical sensors or Firebase.</span></div>
    <section className="panel stage-panel"><div className="panel-head"><div><h2>Process stage monitor</h2><p>Monitor each production stage reported by the machine.</p></div><span className="monitor-count"><Activity size={14}/> 5 production stages</span></div><div className="stage-grid">{stages.map(([name, desc], index)=><div className="stage-card" key={name}><div className="stage-card-top"><div className="stage-card-icon"><Circle size={18}/></div><span className="stage-number">{String(index+1).padStart(2,"0")}</span></div><b>{name}</b><small>{desc}</small><span className="stage-waiting"><i/> Waiting for data</span></div>)}</div><div className="monitor-note"><div className="monitor-note-icon"><Radio size={17}/></div><div><b>What will appear here?</b><p>When the controller is connected, each stage will show its live state. The app monitors progress only; process controls remain on the Nextion HMI.</p></div></div></section>
    <section className="panel"><div className="panel-head"><div><h2>Sensor inputs</h2><p>Pin references from the current project plan</p></div><span className="sample"><i/> NOT CONNECTED</span></div><div className="table-wrap"><table><thead><tr><th>Sensor</th><th>Purpose</th><th>Current value</th><th>Status</th></tr></thead><tbody><tr><td>Middle cotton laser</td><td>Cotton presence</td><td>—</td><td><span className="pill muted">No data</span></td></tr><tr><td>Bottom cotton laser</td><td>Cotton presence</td><td>—</td><td><span className="pill muted">No data</span></td></tr><tr><td>Half liquid sensor</td><td>Liquid level threshold</td><td>—</td><td><span className="pill muted">No data</span></td></tr><tr><td>Full liquid sensor</td><td>Liquid level threshold</td><td>—</td><td><span className="pill muted">No data</span></td></tr></tbody></table></div></section>
  </>;
}
function ProductionHistory({period,setPeriod}) {
  const labels = period === 'This week' ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] : period === 'This month' ? ['Week 1','Week 2','Week 3','Week 4'] : period === 'This year' ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] : ['Today'];
  const periods = <select value={period} onChange={e=>setPeriod(e.target.value)} aria-label="Chart date range"><option>Today</option><option>This week</option><option>This month</option><option>This year</option></select>;
  return <><PageHeading eyebrow="PRODUCTION ANALYTICS" title="Production History" subtitle="Track repellent output, completed pillows, and production events over time." />
    <div className="stats"><Stat icon={Droplets} tone="green" label="Repellent produced" value="—" meta="Awaiting production records" tag="EMPTY"/><Stat icon={Package} tone="blue" label="Pillows produced" value="—" meta="Awaiting production records" tag="EMPTY"/><Stat icon={CheckCircle2} tone="purple" label="Completed" value="—" meta="Awaiting production logs" tag="EMPTY"/><Stat icon={AlertTriangle} tone="orange" label="Interrupted" value="—" meta="Awaiting production logs" tag="EMPTY"/></div>
    <section className="panel production-chart-panel"><div className="panel-head"><div><h2>Repellent production</h2><p>Volume produced during the selected period</p></div>{periods}</div>
      <div className="chart-legend"><span><i className="legend-repellent"/> Repellent produced <small>(mL or L after setup)</small></span></div>
      <div className="production-chart" role="img" aria-label={`Repellent production chart for ${period}; awaiting Firebase data`}>
        <div className="chart-y-labels"><span>—</span><span>—</span><span>—</span><span>—</span></div>
        <div className="chart-plot">{[0,1,2,3].map(n=><div className="chart-gridline" key={n}/>)}
          <div className="chart-empty-state"><div className="chart-empty-icon"><Droplets size={22}/></div><b>No repellent data yet</b><span>Recorded production volume will appear here after Firebase is connected.</span></div>
          <div className="chart-x-labels">{labels.map(label=><span key={label}>{label}</span>)}</div>
        </div>
      </div>
    </section>
    <section className="panel production-chart-panel"><div className="panel-head"><div><h2>Pillow production</h2><p>Completed pillows during the selected period</p></div>{periods}</div>
      <div className="chart-legend"><span><i className="legend-pillows"/> Pillows produced <small>(count)</small></span></div>
      <div className="production-chart" role="img" aria-label={`Pillow production chart for ${period}; awaiting Firebase data`}>
        <div className="chart-y-labels"><span>—</span><span>—</span><span>—</span><span>—</span></div>
        <div className="chart-plot">{[0,1,2,3].map(n=><div className="chart-gridline" key={n}/>)}
          <div className="chart-empty-state"><div className="chart-empty-icon"><Package size={22}/></div><b>No pillow data yet</b><span>Confirmed completed pillows will appear here after Firebase is connected.</span></div>
          <div className="chart-x-labels">{labels.map(label=><span key={label}>{label}</span>)}</div>
        </div>
      </div>
      <div className="chart-footnote"><Radio size={14}/> Charts show recorded machine data only; no sample values are shown.</div>
    </section>
    <section className="panel history-panel"><div className="panel-head"><div><h2>Completed & interrupted history</h2><p>Date and time for each production event, recorded by the machine</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Event</th><th>Date</th><th>Time</th><th>Details</th></tr></thead><tbody><tr><td colSpan="5" className="empty-cell"><History size={23}/><b>No production events yet</b><span>When Firebase is connected, each completed or interrupted event will show its date and time here.</span></td></tr></tbody></table></div>
      <div className="chart-footnote"><Radio size={14}/> Event timestamps will come from recorded controller events; no dates or times are fabricated.</div>
    </section>
  </>;
}
function Alerts({filter,setFilter}) {
  const notifications = [];
  const visibleNotifications = notifications.filter(item =>
    filter === 'All notifications' || item.category === filter
  );
  return <><PageHeading eyebrow="NOTIFICATION CENTER" title="Notifications" subtitle="Notifications appear here only when cotton is empty, a process completes, or a process is interrupted." />
    <section className="panel"><div className="panel-head"><div><h2>Notifications</h2><p>Machine events that need your attention</p></div><select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter notifications"><option>All notifications</option><option>Cotton is empty</option><option>Process completed</option><option>Process interrupted</option></select></div>
      {visibleNotifications.length === 0 ? <div className="empty-cell notification-empty"><Bell size={24}/><b>No notifications yet</b><span>When cotton is empty, a process completes, or a process is interrupted, the notification will appear here.</span></div> : <div className="event-list">{visibleNotifications.map((item)=><div className="event-row" key={item.id}><div className={'event-icon '+item.tone}><item.icon size={17}/></div><div className="event-copy"><b>{item.title}</b><small>{item.detail}</small></div><span className="event-time">{item.time}</span></div>)}</div>}
    </section>
  </>;
}
function SettingsPage({inform}) {
  const [volume,setVolume] = useState('1.50');
  const [adminOnly,setAdminOnly] = useState(true);
  const [autoStop,setAutoStop] = useState(true);
  const [saved,setSaved] = useState(false);
  const save = () => { setSaved(true); inform('Settings saved in this browser session only. Firebase persistence has not been configured.'); };
  return <><PageHeading eyebrow="CONFIGURATION" title="Settings" subtitle="Review proposed process settings and access controls."/>
    <div className="settings-grid"><section className="panel"><div className="panel-head"><div><h2>Dispensing configuration</h2><p>Prototype values for future app-to-device settings.</p></div><div className="settings-icon"><Droplets size={17}/></div></div><label className="field-label" htmlFor="volume">Target liquid amount per dispense (mL)</label><input id="volume" className="field" type="number" min="0.1" max="20" step="0.1" value={volume} onChange={e=>{setVolume(e.target.value);setSaved(false)}}/><small className="field-help">This is a UI-only setting. It does not command a pump.</small><div className="setting-toggle"><div><b>Require admin approval</b><small>Restrict changes to authorized administrators once login is implemented.</small></div><button className={'toggle '+(adminOnly?'on':'')} onClick={()=>{setAdminOnly(v=>!v);setSaved(false)}} aria-pressed={adminOnly}><i/></button></div><div className="setting-toggle"><div><b>Stop on low cotton</b><small>Proposed safety behavior when the cotton sensor reports insufficient material.</small></div><button className={'toggle '+(autoStop?'on':'')} onClick={()=>{setAutoStop(v=>!v);setSaved(false)}} aria-pressed={autoStop}><i/></button></div><button className="btn primary save-btn" onClick={save}><Check size={15}/> Save draft settings</button>{saved&&<p className="save-hint">Draft saved for this browser session.</p>}</section>
    <section className="panel"><div className="panel-head"><div><h2>System configuration</h2><p>Planned connection details</p></div><div className="settings-icon"><SlidersHorizontal size={17}/></div></div><ConfigRow label="Frontend hosting" value="Vercel"/><ConfigRow label="Source control" value="GitHub"/><ConfigRow label="Database" value="Firebase · not configured"/><ConfigRow label="Machine controller" value="Arduino Mega 2560"/><ConfigRow label="Network controller" value="ESP32"/><ConfigRow label="Live status" value="Not connected"/><div className="sensor-note"><ShieldCheck size={16}/> Do not store Firebase service-account secrets in this frontend repository.</div></section></div>
  </>;
}
function ConfigRow({label,value}) { return <div className="config-row"><span>{label}</span><b>{value}</b></div>; }
function Stat({icon: Icon, tone, label, value, meta, tag}) { return <div className="stat"><div className="stat-top"><div className={'stat-icon '+tone}><Icon size={20}/></div><span className="tag">{tag}</span></div><small>{label}</small><b className="stat-value">{value}</b><p>{meta}</p></div>; }
function Sensor({name,desc,icon:Icon,warn}) { return <div className="sensor"><div className="sensor-icon"><Icon size={17}/></div><div className="sensor-copy"><b>{name}</b><small>{desc}</small></div><span className={warn?'warn':'no-data'}><i/>{warn?'Offline':'No data'}</span></div>; }
