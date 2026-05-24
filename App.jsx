import { useState, useEffect } from "react";

const ADMIN_USER = { username: "admin", password: "admin123", name: "Nils Kretschmar", role: "admin", house: "USZ" };
const HOUSES = ["USZ", "Triemli"];

const ZUERCHER_FEIERTAGE = {
  "2025": ["2025-01-01","2025-01-02","2025-04-18","2025-04-21","2025-05-01","2025-05-29","2025-06-09","2025-08-01","2025-09-15","2025-12-25","2025-12-26"],
  "2026": ["2026-01-01","2026-01-02","2026-04-03","2026-04-06","2026-05-01","2026-05-14","2026-05-25","2026-08-03","2026-09-14","2026-12-25","2026-12-26"],
};

function isFeiertag(dateStr) {
  const year = dateStr.slice(0,4);
  return (ZUERCHER_FEIERTAGE[year]||[]).includes(dateStr);
}

function toDateStr(y,m,d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function getWorkdaysInMonth(year, month) {
  const days = [];
  const dim = new Date(year, month+1, 0).getDate();
  for (let d=1; d<=dim; d++) {
    const ds = toDateStr(year, month, d);
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6 && !isFeiertag(ds)) days.push(ds);
  }
  return days;
}

function storageKey(k) { return `arbeitsplan_${k}`; }

function loadData(k, def) {
  try {
    const v = localStorage ? localStorage.getItem(storageKey(k)) : null;
    return v ? JSON.parse(v) : def;
  } catch { return def; }
}

function saveData(k, v) {
  try { localStorage && localStorage.setItem(storageKey(k), JSON.stringify(v)); } catch {}
}

const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const DAYS_DE = ["Mo","Di","Mi","Do","Fr"];

const USER_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B88B", "#ABEBC6",
  "#F1948A", "#7DCEA0", "#85C1E2", "#D7BDE2", "#F9E79F"
];

function getUserColor(username, allUsers) {
  const index = allUsers.findIndex(u => u.username === username);
  return index >= 0 ? USER_COLORS[index % USER_COLORS.length] : "#CCCCCC";
}

export default function App() {
  const [users, setUsers] = useState(() => loadData("users", [ADMIN_USER]));
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserHouse, setCurrentUserHouse] = useState(() => loadData("currentUserHouse", "USZ"));
  const [view, setView] = useState("login");

  const [loginForm, setLoginForm] = useState({username:"",password:""});
  const [regForm, setRegForm] = useState({username:"",password:"",name:"",email:"",house:"USZ"});
  const [loginError, setLoginError] = useState("");

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  const [availability, setAvailability] = useState(() => loadData("availability", {}));
  const [plan, setPlan] = useState(() => loadData("plan", {}));
  const [planFixed, setPlanFixed] = useState(() => loadData("planFixed", {}));
  const [activeTab, setActiveTab] = useState(() => loadData("activeTab", "availability"));
  const [selectedMonth, setSelectedMonth] = useState(() => loadData("selectedMonth", currentMonth));
  const [selectedYear, setSelectedYear] = useState(() => loadData("selectedYear", currentYear));
  const [notifications, setNotifications] = useState(() => loadData("notifications", {}));
  const [viewedNotifications, setViewedNotifications] = useState(() => loadData("viewedNotifications", {}));

  useEffect(() => { saveData("users", users); }, [users]);
  useEffect(() => { saveData("availability", availability); }, [availability]);
  useEffect(() => { saveData("plan", plan); }, [plan]);
  useEffect(() => { saveData("planFixed", planFixed); }, [planFixed]);
  useEffect(() => { saveData("currentUserHouse", currentUserHouse); }, [currentUserHouse]);
  useEffect(() => { saveData("activeTab", activeTab); }, [activeTab]);
  useEffect(() => { saveData("selectedMonth", selectedMonth); }, [selectedMonth]);
  useEffect(() => { saveData("selectedYear", selectedYear); }, [selectedYear]);
  useEffect(() => { saveData("notifications", notifications); }, [notifications]);
  useEffect(() => { saveData("viewedNotifications", viewedNotifications); }, [viewedNotifications]);

  function login() {
    const u = users.find(u => u.username === loginForm.username && u.password === loginForm.password);
    if (!u) { setLoginError("Falscher Benutzername oder Passwort."); return; }
    setCurrentUser(u);
    setCurrentUserHouse(u.house || "USZ");
    setView("app");
    setLoginError("");
  }

  function register() {
    if (!regForm.username || !regForm.password || !regForm.name || !regForm.house) { setLoginError("Alle Felder ausfüllen."); return; }
    if (users.find(u => u.username === regForm.username)) { setLoginError("Benutzername bereits vergeben."); return; }
    const newUser = { ...regForm, role: "user", email: regForm.email || "", house: regForm.house };
    const updated = [...users, newUser];
    setUsers(updated);
    setCurrentUser(newUser);
    setCurrentUserHouse(newUser.house);
    setView("app");
    setLoginError("");
  }

  function getUserAvail(username, year, month) {
    return availability[`${username}_${year}_${month}`] || {};
  }

  function setUserAvail(username, year, month, data) {
    const key = `${username}_${year}_${month}`;
    const updated = {...availability, [key]: data};
    setAvailability(updated);
  }

  function toggleAvail(dateStr, year, month) {
    if (!currentUser) return;
    
    const avail = getUserAvail(currentUser.username, year, month);
    const cur = avail[dateStr] || 0;
    const next = cur === 0 ? 2 : cur === 2 ? 1 : 0;
    setUserAvail(currentUser.username, year, month, {...avail, [dateStr]: next});

    // Check if plan is fixed for this month
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (planFixed[monthKey]) {
      // Plan is fixed - track this change and notify admin
      const notifKey = `${currentUser.username}_${year}_${month}`;
      const oldNotifs = notifications[notifKey] || [];
      
      const change = {
        timestamp: new Date().toISOString(),
        dateStr: dateStr,
        oldValue: cur,
        newValue: next,
        username: currentUser.username,
        name: currentUser.name,
        type: "availability_change"
      };

      setNotifications({
        ...notifications,
        [notifKey]: [...oldNotifs, change]
      });
    }
  }

  function isMonthFull(year, month, house) {
    const houseUsers = users.filter(u => u.house === house && !u.archived);
    const nonAdminUsers = houseUsers.filter(u => u.role !== "admin");
    const adminAvail = getUserAvail(ADMIN_USER.username, year, month);
    const adminSubmitted = Object.keys(adminAvail).length > 0;
    const allOthersSubmitted = nonAdminUsers.every(u => {
      const avail = getUserAvail(u.username, year, month);
      return Object.keys(avail).length > 0;
    });
    return adminSubmitted && allOthersSubmitted;
  }

  function generatePlan(year, month) {
    const workdays = getWorkdaysInMonth(year, month);
    const houseUsers = users.filter(u => u.house === currentUserHouse && u.role !== "admin" && !u.archived);
    const allUsersForPlan = currentUser?.role === "admin" ? [{...ADMIN_USER, house: currentUserHouse}, ...houseUsers] : [...houseUsers];
    
    if (!allUsersForPlan.length) { alert("Keine Benutzer vorhanden."); return; }

    // Check for green days per user (count grüne Tage)
    const greenDaysByUser = {};
    allUsersForPlan.forEach(u => {
      const avail = getUserAvail(u.username, year, month);
      const greenDays = Object.values(avail).filter(v => v === 2).length;
      greenDaysByUser[u.username] = greenDays;
    });

    const preferredDaysPerUser = 4;
    const maxDaysPerUser = 5; // hard cap, but prefer 4 days

    // Show warning if someone has >4 green days
    const usersOverPreferred = allUsersForPlan.filter(u => greenDaysByUser[u.username] > preferredDaysPerUser);
    if (usersOverPreferred.length > 0) {
      const names = usersOverPreferred.map(u => `${u.name} (${greenDaysByUser[u.username]} Tage)`).join(", ");
      const approved = window.confirm(
        `⚠️ Folgende Personen haben >4 grüne Tage: ${names}\n\n` +
        `Das Programm verteilt bevorzugt maximal 4 Tage pro Person, der harte Deckel liegt bei 5 Tagen. Trotzdem fortfahren?`
      );
      if (!approved) return;
    }

    const newPlan = {...plan};
    const userCounts = {};
    const userTargets = {};
    
    // Initialize counts and targets (preferentially 4 days per user, hard cap 5)
    const target = Math.min(Math.round(workdays.length * 0.2), preferredDaysPerUser);
    allUsersForPlan.forEach(u => {
      const existing = Object.entries(plan).filter(([ds, username]) => {
        const [y, m, d] = ds.split('-').map(Number);
        return username === u.username && y === year && m === (month + 1);
      }).length;
      userCounts[u.username] = existing;
      userTargets[u.username] = Math.min(target, maxDaysPerUser);
    });

    // Get week number for a date
    const getWeekNumber = (dateStr) => {
      const date = new Date(dateStr + "T00:00:00");
      const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
      const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
      return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    };

    // Smart allocation with 5-day limit
    workdays.forEach((ds, dayIndex) => {
      const weekNum = getWeekNumber(ds);
      
      let candidates = allUsersForPlan.filter(u => {
        const avail = getUserAvail(u.username, year, month);
        // Filter out: 1) not available, 2) already at 5-day limit
        return (avail[ds] || 0) > 0 && userCounts[u.username] < maxDaysPerUser;
      });

      // Sort candidates strategically
      candidates = candidates.sort((a, b) => {
        const countA = userCounts[a.username];
        const countB = userCounts[b.username];
        const targetA = userTargets[a.username];
        const targetB = userTargets[b.username];
        
        // Priority 1: Check for 2-day block opportunity (if assigned yesterday)
        const yesterday = dayIndex > 0 ? workdays[dayIndex - 1] : null;
        const aHadYesterday = yesterday && newPlan[yesterday] === a.username;
        const bHadYesterday = yesterday && newPlan[yesterday] === b.username;
        
        if (aHadYesterday && !bHadYesterday) return -1;
        if (!aHadYesterday && bHadYesterday) return 1;
        
        // Priority 2: User furthest from their target (lowest pensum)
        const gapA = targetA - countA;
        const gapB = targetB - countB;
        if (gapB !== gapA) return gapB - gapA;
        
        // Priority 3: Availability strength (2 > 1)
        const avA = getUserAvail(a.username, year, month)[ds] || 0;
        const avB = getUserAvail(b.username, year, month)[ds] || 0;
        if (avB !== avA) return avB - avA;
        
        // Priority 4: Name (alphabetical)
        return a.name.localeCompare(b.name);
      });

      if (candidates.length > 0) {
        const chosen = candidates[0];
        newPlan[ds] = chosen.username;
        userCounts[chosen.username]++;
      }
    });

    setPlan(newPlan);
    alert(`Plan für ${MONTHS_DE[month]} ${year} erstellt! (Bevorzugt 4 Tage pro Person, max. 5)`);
  }

  function addServiceDay(dateStr, username) {
    const newPlan = {...plan};
    if (newPlan[dateStr] && newPlan[dateStr] !== username) {
      alert("Dieser Tag ist bereits vergeben.");
      return;
    }
    newPlan[dateStr] = username;
    setPlan(newPlan);
  }

  function removeServiceDay(dateStr) {
    const newPlan = {...plan};
    delete newPlan[dateStr];
    setPlan(newPlan);
  }

  function getMonthPensum(username, year, month) {
    const wds = getWorkdaysInMonth(year, month).length;
    const planned = Object.entries(plan).filter(([ds, u]) => {
      const [y, m, d] = ds.split('-').map(Number);
      return u === username && y === year && m === (month + 1);
    }).length;
    return wds > 0 ? planned / wds : 0;
  }

  function getYearPensum(username) {
    const monthPensums = [];
    for (let m = 0; m < 12; m++) {
      const p = getMonthPensum(username, currentYear, m);
      if (p > 0) monthPensums.push(p);
    }
    return monthPensums.length > 0 ? (monthPensums.reduce((a, b) => a + b) / monthPensums.length) : 0;
  }

  if (view === "login") return (
    <div style={{maxWidth:360,margin:"2rem auto",padding:"1.5rem",background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)"}}>
      <h2 style={{fontSize:18,fontWeight:500,marginBottom:16}}>Anmelden</h2>
      <input placeholder="Benutzername" value={loginForm.username} onChange={e=>setLoginForm({...loginForm,username:e.target.value})} style={{width:"100%",marginBottom:8,boxSizing:"border-box"}} />
      <input type="password" placeholder="Passwort" value={loginForm.password} onChange={e=>setLoginForm({...loginForm,password:e.target.value})} style={{width:"100%",marginBottom:8,boxSizing:"border-box"}} />
      {loginError && <p style={{color:"var(--color-text-danger)",fontSize:13,margin:"4px 0"}}>{loginError}</p>}
      <button onClick={login} style={{width:"100%",marginBottom:8}}>Anmelden</button>
      <button onClick={()=>{setView("register");setLoginError("")}} style={{width:"100%",background:"none",border:"none",color:"var(--color-text-info)",cursor:"pointer",fontSize:14}}>Noch kein Konto? Registrieren</button>
    </div>
  );

  if (view === "register") return (
    <div style={{maxWidth:360,margin:"2rem auto",padding:"1.5rem",background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)"}}>
      <h2 style={{fontSize:18,fontWeight:500,marginBottom:16}}>Registrieren</h2>
      <input placeholder="Vollständiger Name" value={regForm.name} onChange={e=>setRegForm({...regForm,name:e.target.value})} style={{width:"100%",marginBottom:8,boxSizing:"border-box"}} />
      <input placeholder="Benutzername" value={regForm.username} onChange={e=>setRegForm({...regForm,username:e.target.value})} style={{width:"100%",marginBottom:8,boxSizing:"border-box"}} />
      <input type="email" placeholder="Email-Adresse (optional)" value={regForm.email} onChange={e=>setRegForm({...regForm,email:e.target.value})} style={{width:"100%",marginBottom:8,boxSizing:"border-box"}} />
      <select value={regForm.house} onChange={e=>setRegForm({...regForm,house:e.target.value})} style={{width:"100%",marginBottom:8,boxSizing:"border-box",fontSize:14,padding:"6px 8px"}}>
        <option value="">Haus auswählen</option>
        <option value="USZ">USZ</option>
        <option value="Triemli">Triemli</option>
      </select>
      <input type="password" placeholder="Passwort" value={regForm.password} onChange={e=>setRegForm({...regForm,password:e.target.value})} style={{width:"100%",marginBottom:8,boxSizing:"border-box"}} />
      {loginError && <p style={{color:"var(--color-text-danger)",fontSize:13,margin:"4px 0"}}>{loginError}</p>}
      <button onClick={register} style={{width:"100%",marginBottom:8}}>Konto erstellen</button>
      <button onClick={()=>{setView("login");setLoginError("")}} style={{width:"100%",background:"none",border:"none",color:"var(--color-text-info)",cursor:"pointer",fontSize:14}}>Zurück zum Login</button>
    </div>
  );

  const isAdmin = currentUser?.role === "admin";
  const todayStr = toDateStr(currentYear, currentMonth, today.getDate());
  const appTitle = currentUserHouse === "Triemli" ? "Triemli Arbeitsplan" : "USZeit";
  
  // Count unread notifications for current month
  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const monthNotifications = Object.entries(notifications)
    .filter(([key]) => key.endsWith(`_${selectedYear}_${selectedMonth}`))
    .flatMap(([_, notifs]) => notifs || []);
  const unreadCount = monthNotifications.filter(n => !viewedNotifications[`${monthKey}_${n.timestamp}`]).length;

  return (
    <div style={{padding:"1.5rem",maxWidth:"1400px",margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
        <h1 style={{fontSize:24,fontWeight:500,margin:0}}>{appTitle}</h1>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {isAdmin && unreadCount > 0 && (
            <div style={{padding:"6px 12px",background:"#FFA500",color:"white",borderRadius:4,fontSize:12,fontWeight:500}}>
              🔔 {unreadCount} neue Änderung{unreadCount === 1 ? "" : "en"}
            </div>
          )}
          <span style={{fontSize:13,color:"var(--color-text-secondary)"}}>👤 {currentUser?.name}</span>
          {isAdmin && <span style={{fontSize:12,padding:"2px 8px",background:"var(--color-background-secondary)",borderRadius:4}}>Admin</span>}
          {isAdmin && (
            <select value={currentUserHouse} onChange={e=>setCurrentUserHouse(e.target.value)} style={{fontSize:12,padding:"4px 8px",borderRadius:4}}>
              <option value="USZ">USZ</option>
              <option value="Triemli">Triemli</option>
            </select>
          )}
          <button onClick={()=>{setCurrentUser(null);setView("login")}} style={{fontSize:13,padding:"4px 10px"}}>Abmelden</button>
        </div>
      </div>

      {/* Notification Alert for Month */}
      {isAdmin && Object.keys(notifications).length > 0 && (
        <div style={{background:"#FFF4E6",border:"0.5px solid #FFC107",borderRadius:"var(--border-radius-lg)",padding:"1rem",marginBottom:"1.5rem"}}>
          <div style={{fontSize:13,fontWeight:500,color:"#854F0B"}}>
            ⚠️ <strong>{unreadCount} ungelesene Verfügbarkeitsänderung{unreadCount === 1 ? "" : "en"}</strong> in diesem Monat
          </div>
          <div style={{fontSize:12,color:"#854F0B",marginTop:4}}>Mitarbeiter haben ihre Verfügbarkeit nach Plan-Fixierung geändert. Siehe Verfügbarkeit-Tab.</div>
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:"1.5rem",borderBottom:"0.5px solid var(--color-border-tertiary)",paddingBottom:8}}>
        {(isAdmin ? ["availability","schedule","overview","admin","history"] : ["availability","schedule","profile","history"]).map(t => (
          <button key={t} onClick={()=>setActiveTab(t)} style={{background: activeTab===t ? "var(--color-background-secondary)" : "none", fontWeight: activeTab===t ? 500 : 400, border:"0.5px solid var(--color-border-tertiary)", padding:"6px 14px", borderRadius:"var(--border-radius-md)"}}>
            {t==="availability" ? "Verfügbarkeit" : t==="schedule" ? "Plan" : t==="overview" ? "Übersicht" : t==="admin" ? "Admin-Tools" : t==="profile" ? "Mein Profil" : "Verlauf"}
          </button>
        ))}
      </div>

      {activeTab === "availability" && (
        <AvailabilityView
          users={users}
          currentUser={currentUser}
          isAdmin={isAdmin}
          availability={availability}
          getUserAvail={getUserAvail}
          toggleAvail={toggleAvail}
          isMonthFull={isMonthFull}
          currentUserHouse={currentUserHouse}
          currentYear={currentYear}
          currentMonth={currentMonth}
        />
      )}

      {activeTab === "schedule" && (
        <ScheduleView
          users={users}
          currentUser={currentUser}
          isAdmin={isAdmin}
          plan={plan}
          planFixed={planFixed}
          setPlanFixed={setPlanFixed}
          availability={availability}
          getUserAvail={getUserAvail}
          generatePlan={generatePlan}
          addServiceDay={addServiceDay}
          removeServiceDay={removeServiceDay}
          getMonthPensum={getMonthPensum}
          todayStr={todayStr}
          currentYear={currentYear}
          currentMonth={currentMonth}
          today={today}
        />
      )}

      {activeTab === "overview" && (
        <OverviewView
          users={users}
          isAdmin={isAdmin}
          plan={plan}
          getMonthPensum={getMonthPensum}
          getYearPensum={getYearPensum}
          currentYear={currentYear}
        />
      )}

      {activeTab === "profile" && (
        <ProfileView
          currentUser={currentUser}
          plan={plan}
          today={today}
          currentYear={currentYear}
          currentMonth={currentMonth}
        />
      )}

      {activeTab === "admin" && (
        <AdminToolsView
          users={users}
          setUsers={setUsers}
          isAdmin={isAdmin}
        />
      )}

      {activeTab === "history" && (
        <HistoryView
          plan={plan}
          users={users}
          currentUser={currentUser}
          currentYear={currentYear}
          currentMonth={currentMonth}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

function AvailabilityView({ users, currentUser, isAdmin, availability, getUserAvail, toggleAvail, isMonthFull, currentYear, currentMonth, currentUserHouse }) {
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);

  // Filter users by house
  const houseUsers = users.filter(u => u.house === currentUserHouse && !u.archived);
  const nonAdminUsers = houseUsers.filter(u => u.role !== "admin");
  const allUsersForDisplay = isAdmin ? [...nonAdminUsers, {username: "admin", name: "Nils Kretschmar", house: currentUserHouse}] : [currentUser];

  const isFull = isMonthFull(year, month, currentUserHouse);

  const submittedStatus = isAdmin ? nonAdminUsers.map(u => {
    const avail = getUserAvail(u.username, year, month);
    return { user: u, submitted: Object.keys(avail).length > 0 };
  }) : null;

  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:"1.5rem",alignItems:"center",flexWrap:"wrap"}}>
        <select value={year} onChange={e=>setYear(parseInt(e.target.value))} style={{fontSize:14,padding:"6px 12px"}}>
          {[currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e=>setMonth(parseInt(e.target.value))} style={{fontSize:14,padding:"6px 12px"}}>
          {[...Array(12)].map((_, i) => <option key={i} value={i}>{MONTHS_DE[i]}</option>)}
        </select>

        {isFull && isAdmin && (
          <span style={{fontSize:12,padding:"4px 8px",background:"#EAF3DE",color:"#3B6D11",borderRadius:4}}>✓ Alle eingetragen</span>
        )}
      </div>

      {isAdmin && submittedStatus && (
        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem",marginBottom:"1.5rem"}}>
          <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Status - {MONTHS_DE[month]} {year} ({currentUserHouse})</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:12}}>
            {[{user:{username:"admin",name:"Nils Kretschmar",house:currentUserHouse}}, ...submittedStatus].map(({user, submitted}) => (
              <div key={user.user?.username || user.username} style={{padding:"10px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",borderLeft:`4px solid ${submitted !== false && user.user ? "#639922" : "#d13438"}`}}>
                <div style={{fontSize:14,fontWeight:500}}>{user.user?.name || user.name}</div>
                <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:4}}>
                  {submitted !== false && user.user ? "✓ Eingegeben" : submitted === false ? "○ Ausstehend" : "Kann eingeben"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.5rem"}}>
        {allUsersForDisplay.map(user => (
          <MonthCalendar
            key={user.username}
            year={year}
            month={month}
            user={user}
            currentUser={currentUser}
            availability={getUserAvail(user.username, year, month)}
            onToggle={(ds) => toggleAvail(ds, year, month)}
            readOnly={currentUser?.username !== user.username && !isAdmin}
          />
        ))}
      </div>
    </div>
  );
}

function ScheduleView({ users, currentUser, isAdmin, plan, planFixed, setPlanFixed, availability, getUserAvail, generatePlan, addServiceDay, removeServiceDay, getMonthPensum, todayStr, currentYear, currentMonth, today }) {
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);

  const workdays = getWorkdaysInMonth(year, month);
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const isMonthFixed = planFixed[monthKey] || false;
  const canEdit = isAdmin && (year > currentYear || (year === currentYear && month > currentMonth)) && !isMonthFixed;
  const isCurrentMonth = year === currentYear && month === currentMonth;

  const nonAdminUsers = users.filter(u => u.role !== "admin" && !u.archived);
  const allUsersForPlan = [ADMIN_USER, ...nonAdminUsers];

  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:"1.5rem",alignItems:"center",flexWrap:"wrap"}}>
        <select value={year} onChange={e=>setYear(parseInt(e.target.value))} style={{fontSize:14,padding:"6px 12px"}}>
          {[currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e=>setMonth(parseInt(e.target.value))} style={{fontSize:14,padding:"6px 12px"}}>
          {[...Array(12)].map((_, i) => {
            const isValid = year > currentYear || (year === currentYear && i >= currentMonth);
            return isValid ? <option key={i} value={i}>{MONTHS_DE[i]}</option> : null;
          })}
        </select>

        {isAdmin && !isMonthFixed && (
          <button onClick={() => generatePlan(year, month)} style={{fontSize:14,padding:"6px 12px",background:"#639922",color:"white",border:"none",borderRadius:4,cursor:"pointer"}}>
            Plan generieren
          </button>
        )}

        {isAdmin && Object.keys(plan).some(ds => ds.startsWith(monthKey)) && (
          <button 
            onClick={() => setPlanFixed({...planFixed, [monthKey]: !isMonthFixed})}
            style={{fontSize:14,padding:"6px 12px",background:isMonthFixed ? "#d13438" : "#0078D4",color:"white",border:"none",borderRadius:4,cursor:"pointer"}}
          >
            {isMonthFixed ? "🔒 Plan Entsperren" : "🔓 Plan Fixieren"}
          </button>
        )}
      </div>

      {isCurrentMonth && (
        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem",marginBottom:"1.5rem"}}>
          <div style={{fontSize:13,color:"var(--color-text-secondary)"}}>Heute: <b>{todayStr}</b></div>
        </div>
      )}

      {isMonthFixed && (
        <div style={{background:"#EAF3DE",border:"0.5px solid #639922",borderRadius:"var(--border-radius-lg)",padding:"1rem",marginBottom:"1.5rem",color:"#3B6D11"}}>
          <div style={{fontSize:13}}><strong>🔒 Plan fixiert</strong> - Alle Mitglieder haben abgestimmt. Änderungen sind auf dem Admin-Tab möglich.</div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"1.5rem"}}>
        <MonthSchedule
          year={year}
          month={month}
          plan={plan}
          users={users}
          workdays={getWorkdaysInMonth(year, month)}
          canEdit={canEdit}
          isAdmin={isAdmin}
          currentUser={currentUser}
          addServiceDay={addServiceDay}
          removeServiceDay={removeServiceDay}
          todayStr={todayStr}
          allUsersForPlan={allUsersForPlan}
          getMonthPensum={getMonthPensum}
        />

      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
        <h3 style={{fontSize:15,fontWeight:500,marginBottom:8}}>Pensum Übersicht</h3>
        {allUsersForPlan.map(u => {
          const pensum = getMonthPensum(u.username, year, month);
          const getColor = (p) => {
            if (p < 0.15) return "#d13438";
            if (p > 0.25) return "#d13438";
            return "#639922";
          };
          return (
            <div key={u.username} style={{fontSize:13,padding:"6px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",display:"flex",justifyContent:"space-between"}}>
              <span>{u.name}</span>
              <span style={{fontWeight:500,color: getColor(pensum)}}>
                {Math.round(pensum * 100)}%
              </span>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

function OverviewView({ users, isAdmin, plan, getMonthPensum, getYearPensum, currentYear }) {
  if (!isAdmin) return <p style={{color:"var(--color-text-secondary)"}}>Nur für Admins sichtbar.</p>;

  const nonAdminUsers = users.filter(u => u.role !== "admin");

  return (
    <div>
      <h2 style={{fontSize:18,fontWeight:500,marginBottom:"1.5rem"}}>Admin Übersicht</h2>
      
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:"1.5rem"}}>
        {[{username:"admin",name:"Nils Kretschmar"}, ...nonAdminUsers].map(user => (
          <UserOverviewCard
            key={user.username}
            user={user}
            plan={plan}
            getMonthPensum={getMonthPensum}
            getYearPensum={getYearPensum}
            currentYear={currentYear}
          />
        ))}
      </div>
    </div>
  );
}

function ProfileView({ currentUser, plan, today, currentYear, currentMonth }) {
  const futureDays = Object.entries(plan)
    .filter(([dateStr, username]) => {
      if (username !== currentUser?.username) return false;
      const dayDate = new Date(dateStr + "T00:00:00");
      return dayDate > today;
    })
    .sort((a, b) => new Date(a[0]) - new Date(b[0]));

  const getWorkTime = (dateStr) => {
    const dow = new Date(dateStr + "T00:00:00").getDay();
    return dow === 3 ? "07:00 - 16:00" : "07:15 - 16:00";
  };

  const exportToAppleCalendar = () => {
    // Generate iCal format
    let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//USZ Herzchirurgie//Arbeitsplan//DE
CALSCALE:GREGORIAN
METHOD:PUBLISH
TITLE:USZ - Herzchirurgie Schichteplan
`;

    futureDays.forEach(([dateStr, _]) => {
      const dayDate = new Date(dateStr + "T00:00:00");
      const dow = dayDate.getDay();
      const [startHour, startMin] = dow === 3 ? ["07", "00"] : ["07", "15"];
      const startTime = `${dateStr.replace(/-/g, "")}T${startHour}${startMin}00`;
      const endTime = `${dateStr.replace(/-/g, "")}T160000`;

      ical += `BEGIN:VEVENT
UID:uszsz-${dateStr}@uzz.ch
DTSTART:${startTime}
DTEND:${endTime}
SUMMARY:USZ - Herzchirurgie
DESCRIPTION:Schicht im Operationssaal
LOCATION:USZ Herzchirurgie
SEQUENCE:0
STATUS:CONFIRMED
END:VEVENT
`;
    });

    ical += `END:VCALENDAR`;

    // Download as .ics file
    const blob = new Blob([ical], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `USZ-Herzchirurgie-${currentUser?.username}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 style={{fontSize:18,fontWeight:500,marginBottom:"1.5rem"}}>Mein Profil - {currentUser?.name}</h2>

      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem",marginBottom:"1.5rem"}}>
        <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Zukünftige Arbeitstage</h3>
        {futureDays.length === 0 ? (
          <p style={{fontSize:13,color:"var(--color-text-secondary)"}}>Keine zukünftigen Arbeitstage eingeplant.</p>
        ) : (
          <div>
            <div style={{marginBottom:12}}>
              <button 
                onClick={exportToAppleCalendar}
                style={{fontSize:12,padding:"6px 12px",background:"#555555",color:"white",border:"none",borderRadius:4,cursor:"pointer",marginRight:8}}
              >
                🍎 Zu Apple Kalender exportieren
              </button>
            </div>
            {futureDays.map(([dateStr, _], idx) => {
              const dayDate = new Date(dateStr + "T00:00:00");
              const dayName = DAYS_DE[dayDate.getDay() === 0 ? 6 : dayDate.getDay() - 1];
              const time = getWorkTime(dateStr);
              return (
                <div key={idx} style={{fontSize:13,padding:"10px",background:"var(--color-background-secondary)",borderRadius:4,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:500}}>{dateStr}</div>
                    <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>🕒 {time} ({dayName})</div>
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    <button 
                      onClick={() => {
                        const dayDate = new Date(dateStr + "T00:00:00");
                        const startTime = dayDate.getDay() === 3 ? "07:00" : "07:15";
                        const title = `USZ - Herzchirurgie`;
                        const startDate = new Date(dayDate);
                        const [h, m] = startTime.split(":").map(Number);
                        startDate.setHours(h, m, 0);
                        const endDate = new Date(startDate);
                        endDate.setHours(16, 0, 0);
                        
                        const calendarUrl = `https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(title)}&dates=${startDate.toISOString().replace(/[-:]/g,"").slice(0,15)}Z/${endDate.toISOString().replace(/[-:]/g,"").slice(0,15)}Z&details=${encodeURIComponent("USZ Herzchirurgie")}`;
                        window.open(calendarUrl, "_blank");
                      }}
                      style={{fontSize:11,padding:"4px 8px",background:"#4285F4",color:"white",border:"none",borderRadius:3,cursor:"pointer"}}
                    >
                      📅 Google
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
        <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Ziel-Pensum</h3>
        <div style={{fontSize:13,marginBottom:8}}>
          <strong>Ziel:</strong> 20% pro Monat (durchschnittlich)
        </div>
        <p style={{fontSize:12,color:"var(--color-text-secondary)"}}>
          Dein durchschnittliches monatliches Pensum wird in der Plan-Übersicht angezeigt. Grün = 15-25%, Rot = außerhalb des Zielbereichs.
        </p>
      </div>
    </div>
  );
}

function AdminToolsView({ users, setUsers, isAdmin }) {
  if (!isAdmin) return <p style={{color:"var(--color-text-secondary)"}}>Nur für Admins sichtbar.</p>;

  const [editingEmail, setEditingEmail] = useState(null);
  const [tempEmail, setTempEmail] = useState("");

  const toggleAdmin = (username) => {
    setUsers(users.map(u => 
      u.username === username ? {...u, role: u.role === "admin" ? "user" : "admin"} : u
    ));
  };

  const toggleArchive = (username) => {
    setUsers(users.map(u => 
      u.username === username ? {...u, archived: !u.archived} : u
    ));
  };

  const removeUser = (username) => {
    if (window.confirm(`Benutzer "${username}" wirklich löschen?`)) {
      setUsers(users.filter(u => u.username !== username));
    }
  };

  const updateEmail = (username, newEmail) => {
    setUsers(users.map(u => 
      u.username === username ? {...u, email: newEmail} : u
    ));
    setEditingEmail(null);
  };

  const activeUsers = users.filter(u => !u.archived);
  const archivedUsers = users.filter(u => u.archived);

  return (
    <div>
      <h2 style={{fontSize:18,fontWeight:500,marginBottom:"1.5rem"}}>Admin-Tools</h2>

      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem",marginBottom:"1.5rem"}}>
        <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Aktive Benutzer ({activeUsers.length})</h3>
        {activeUsers.map(u => (
          <div key={u.username} style={{padding:"10px",background:"var(--color-background-secondary)",borderRadius:4,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:"150px"}}>
              <div style={{fontWeight:500}}>{u.name}</div>
              <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>@{u.username}</div>
              {editingEmail === u.username ? (
                <div style={{display:"flex",gap:4,marginTop:6}}>
                  <input 
                    type="email" 
                    value={tempEmail}
                    onChange={(e) => setTempEmail(e.target.value)}
                    placeholder="Email"
                    style={{fontSize:12,padding:"4px 6px",flex:1,minWidth:"150px"}}
                  />
                  <button 
                    onClick={() => updateEmail(u.username, tempEmail)}
                    style={{fontSize:11,padding:"4px 8px",background:"#639922",color:"white",border:"none",borderRadius:3,cursor:"pointer"}}
                  >
                    ✓
                  </button>
                  <button 
                    onClick={() => setEditingEmail(null)}
                    style={{fontSize:11,padding:"4px 8px",background:"#d13438",color:"white",border:"none",borderRadius:3,cursor:"pointer"}}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:4,cursor:"pointer"}} onClick={() => {setEditingEmail(u.username); setTempEmail(u.email || "");}}>
                  📧 {u.email ? u.email : <span style={{fontStyle:"italic"}}>Keine Email</span>}
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:6}}>
              <button
                onClick={() => toggleAdmin(u.username)}
                style={{fontSize:11,padding:"4px 8px",background:u.role === "admin" ? "#639922" : "#8A8A8A",color:"white",border:"none",borderRadius:3,cursor:"pointer"}}
              >
                {u.role === "admin" ? "👑 Admin" : "Zu Admin"}
              </button>
              <button
                onClick={() => toggleArchive(u.username)}
                style={{fontSize:11,padding:"4px 8px",background:"#FFC107",color:"white",border:"none",borderRadius:3,cursor:"pointer"}}
              >
                📦 Archiv
              </button>
              {u.username !== "admin" && (
                <button
                  onClick={() => removeUser(u.username)}
                  style={{fontSize:11,padding:"4px 8px",background:"#d13438",color:"white",border:"none",borderRadius:3,cursor:"pointer"}}
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {archivedUsers.length > 0 && (
        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
          <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Archivierte Benutzer ({archivedUsers.length})</h3>
          {archivedUsers.map(u => (
            <div key={u.username} style={{padding:"10px",background:"var(--color-background-secondary)",borderRadius:4,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",opacity:0.6}}>
              <div>
                <div style={{fontWeight:500}}>{u.name}</div>
                <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>@{u.username}</div>
              </div>
              <button
                onClick={() => toggleArchive(u.username)}
                style={{fontSize:11,padding:"4px 8px",background:"#639922",color:"white",border:"none",borderRadius:3,cursor:"pointer"}}
              >
                ↩️ Reaktivieren
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryView({ plan, users, currentUser, currentYear, currentMonth, isAdmin }) {
  const today = new Date();
  
  // Group plans by month
  const monthPlans = {};
  Object.entries(plan).forEach(([dateStr, username]) => {
    const [y, m] = dateStr.split('-').map(Number);
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    if (!monthPlans[monthKey]) monthPlans[monthKey] = [];
    monthPlans[monthKey].push({ date: dateStr, user: username });
  });

  // Get past and future months
  const sortedMonths = Object.keys(monthPlans).sort().reverse();
  const pastMonths = sortedMonths.filter(k => {
    const [y, m] = k.split('-').map(Number);
    const date = new Date(y, m - 1, 1);
    return date < today;
  });

  return (
    <div>
      <h2 style={{fontSize:18,fontWeight:500,marginBottom:"1.5rem"}}>Plan-Verlauf</h2>

      {pastMonths.length === 0 ? (
        <p style={{color:"var(--color-text-secondary)"}}>Keine vergangenen Pläne vorhanden.</p>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(350px,1fr))",gap:"1.5rem"}}>
          {pastMonths.map(monthKey => {
            const [year, month] = monthKey.split('-').map(Number);
            const workdays = getWorkdaysInMonth(year, month - 1);
            const entries = monthPlans[monthKey];
            
            if (!isAdmin) {
              // Non-admin: only show own days
              const myDays = entries.filter(e => e.user === currentUser?.username);
              if (myDays.length === 0) return null;
              
              return (
                <div key={monthKey} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
                  <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>📅 {MONTHS_DE[month - 1]} {year}</h3>
                  <div>
                    {myDays.map((e, idx) => (
                      <div key={idx} style={{fontSize:13,padding:"6px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
                        <strong>{e.date}</strong>
                        <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                          📍 Herzchirurgie
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            
            // Admin: show all days grouped by user
            const userDays = {};
            entries.forEach(e => {
              if (!userDays[e.user]) userDays[e.user] = [];
              userDays[e.user].push(e.date);
            });

            return (
              <div key={monthKey} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
                <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>📅 {MONTHS_DE[month - 1]} {year}</h3>
                <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:10}}>
                  {entries.length} / {workdays.length} Tage besetzt
                </div>
                {Object.entries(userDays).map(([username, days]) => {
                  const user = users.find(u => u.username === username);
                  return (
                    <div key={username} style={{marginBottom:12,padding:8,background:"var(--color-background-secondary)",borderRadius:4}}>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{user?.name || username}</div>
                      <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                        {days.length} Tage: {days.join(", ")}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserOverviewCard({ user, plan, getMonthPensum, getYearPensum, currentYear }) {
  const yearPensum = getYearPensum(user.username);
  const monthPensums = [...Array(12)].map((_, m) => getMonthPensum(user.username, currentYear, m));
  const totalDays = Object.values(plan).filter(u => u === user.username).length;

  const getPensumColor = (p) => {
    if (p < 0.15) return "#d13438";
    if (p > 0.25) return "#d13438";
    return "#639922";
  };

  return (
    <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
      <h3 style={{fontSize:16,fontWeight:500,marginBottom:12}}>{user.name}</h3>
      
      <div style={{marginBottom:12,padding:"8px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)"}}>
        <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>Ø Jahres-Pensum</div>
        <div style={{fontSize:22,fontWeight:500,marginTop:4,color:getPensumColor(yearPensum)}}>{Math.round(yearPensum * 100)}%</div>
      </div>

      <div style={{marginBottom:12,padding:"8px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)"}}>
        <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>Arbeitstage</div>
        <div style={{fontSize:22,fontWeight:500,marginTop:4}}>{totalDays}</div>
      </div>

      <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:8}}>Monatlich:</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
        {MONTHS_DE.map((m, i) => (
          <div key={i} style={{padding:"4px",background:"var(--color-background-secondary)",borderRadius:3,fontSize:11,textAlign:"center",borderLeft:`3px solid ${getPensumColor(monthPensums[i])}`}}>
            <div>{m.slice(0,3)}</div>
            <div style={{fontWeight:500}}>{Math.round(monthPensums[i] * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthCalendar({ year, month, user, currentUser, availability, onToggle, readOnly }) {
  const workdays = getWorkdaysInMonth(year, month);
  const dim = new Date(year, month+1, 0).getDate();

  const weeks = [];
  let week = Array(7).fill(null);
  for (let d=1; d<=dim; d++) {
    const dow = new Date(year, month, d).getDay();
    const adjusted = dow === 0 ? 6 : dow - 1;
    week[adjusted] = d;
    if (adjusted === 6 || d === dim) {
      weeks.push([...week]);
      week = Array(7).fill(null);
    }
  }

  const greenDays = Object.values(availability).filter(v => v === 2).length;
  const yellowDays = Object.values(availability).filter(v => v === 1).length;

  return (
    <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
      <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>{user.name} - {MONTHS_DE[month]} {year}</h3>

      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:2,marginBottom:8}}>
        {DAYS_DE.map(d => <div key={d} style={{textAlign:"center",fontSize:11,color:"var(--color-text-secondary)",fontWeight:500}}>{d}</div>)}
      </div>

      {weeks.map((wk,wi) => (
        <div key={wi} style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:2,marginBottom:2}}>
          {wk.slice(0,5).map((d,di) => {
            if (!d) return <div key={di}/>;
            const ds = toDateStr(year, month, d);
            const isWorkday = workdays.includes(ds);
            const val = availability[ds] || 0;

            let bg = "var(--color-background-secondary)";
            let color = "var(--color-text-secondary)";

            if (!isWorkday) {
              bg = "var(--color-background-tertiary)";
              color = "var(--color-text-tertiary)";
            } else if (val === 2) {
              bg = "#EAF3DE";
              color = "#3B6D11";
            } else if (val === 1) {
              bg = "#FAEEDA";
              color = "#854F0B";
            }

            return (
              <div
                key={di}
                onClick={() => isWorkday && !readOnly && onToggle && onToggle(ds)}
                style={{background:bg,color,border:"0.5px solid var(--color-border-tertiary)",borderRadius:4,padding:"4px 2px",textAlign:"center",fontSize:11,fontWeight:500,cursor: isWorkday && !readOnly ? "pointer" : "default",minHeight:28,display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.1s"}}
              >
                {d}
              </div>
            );
          })}
        </div>
      ))}

      <div style={{display:"flex",gap:8,marginTop:8,fontSize:11,color:"var(--color-text-secondary)"}}>
        <span style={{background:"#EAF3DE",color:"#3B6D11",padding:"2px 6px",borderRadius:3}}>● {greenDays} grün</span>
        <span style={{background:"#FAEEDA",color:"#854F0B",padding:"2px 6px",borderRadius:3}}>● {yellowDays} gelb</span>
      </div>
    </div>
  );
}

function MonthSchedule({ year, month, plan, users, workdays, canEdit, isAdmin, currentUser, addServiceDay, removeServiceDay, todayStr, allUsersForPlan, getMonthPensum }) {
  const [editMode, setEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");

  const weeks = [];
  const dim = new Date(year, month+1, 0).getDate();
  let week = Array(7).fill(null);
  for (let d=1; d<=dim; d++) {
    const dow = new Date(year, month, d).getDay();
    const adjusted = dow === 0 ? 6 : dow - 1;
    week[adjusted] = d;
    if (adjusted === 6 || d === dim) {
      weeks.push([...week]);
      week = Array(7).fill(null);
    }
  }

  return (
    <div>
      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem",marginBottom:"1.5rem"}}>
        <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Plan {MONTHS_DE[month]} {year}</h3>

        {canEdit && editMode && (
          <div style={{background:"var(--color-background-secondary)",padding:"10px",borderRadius:4,marginBottom:12}}>
            <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} style={{fontSize:12,marginBottom:8,padding:"4px 8px",width:"100%"}}>
              <option value="">Mitarbeiter auswählen</option>
              {allUsersForPlan.map(u => <option key={u.username} value={u.username}>{u.name}</option>)}
            </select>
            <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>Klick auf einen freien Tag um Person zuzuweisen</div>
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:2,marginBottom:8}}>
          {DAYS_DE.map(d => <div key={d} style={{textAlign:"center",fontSize:11,color:"var(--color-text-secondary)",fontWeight:500}}>{d}</div>)}
        </div>

        {weeks.map((wk,wi) => (
          <div key={wi} style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:2,marginBottom:2}}>
            {wk.slice(0,5).map((d,di) => {
              if (!d) return <div key={di}/>;
              const ds = toDateStr(year, month, d);
              const isWorkday = workdays.includes(ds);
              const assignedUser = plan[ds];
              const user = users.find(u => u.username === assignedUser);
              const isToday = ds === todayStr;
              const userColor = user ? getUserColor(user.username, allUsersForPlan) : "transparent";

              let bg = "var(--color-background-secondary)";
              let color = "var(--color-text-secondary)";
              let border = isToday ? "3px solid #0078D4" : "0.5px solid var(--color-border-tertiary)";

              if (!isWorkday) {
                bg = "var(--color-background-tertiary)";
                color = "var(--color-text-tertiary)";
              } else if (assignedUser) {
                bg = userColor;
                color = "white";
              }

              return (
                <div
                  key={di}
                  onClick={() => {
                    if (!isWorkday) return;
                    if (editMode && selectedUser && !assignedUser) {
                      addServiceDay(ds, selectedUser);
                      setSelectedUser("");
                    } else if (canEdit && (isAdmin || assignedUser === currentUser?.username) && editMode) {
                      removeServiceDay(ds);
                    }
                  }}
                  style={{background:bg,color,border,borderRadius:4,padding:"6px 2px",textAlign:"center",fontSize:11,fontWeight:500,cursor: isWorkday ? "pointer" : "default",minHeight:50,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",transition:"background 0.1s"}}
                >
                  <div style={{fontWeight:600}}>{d}</div>
                  {user && <div style={{fontSize:8,marginTop:2,opacity:0.9}}>{user.name.split(" ")[0]}</div>}
                </div>
              );
            })}
          </div>
        ))}

        {canEdit && (
          <button onClick={() => setEditMode(!editMode)} style={{marginTop:12,fontSize:12,padding:"6px 12px",background:editMode ? "#d13438" : "#639922",color:"white",border:"none",borderRadius:4,cursor:"pointer"}}>
            {editMode ? "Bearbeitung abbrechen" : "Plan bearbeiten"}
          </button>
        )}
      </div>

      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem",marginBottom:"1.5rem"}}>
        <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Legende</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
          {allUsersForPlan.map(u => (
            <div key={u.username} style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
              <div style={{width:16,height:16,background:getUserColor(u.username, allUsersForPlan),borderRadius:3}}/>
              <span>{u.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}