import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { mergePlanData, mergePlanFixedData } from "./planStorage";

// ========== FIREBASE CONFIG ==========
const firebaseConfig = {
  apiKey: "AIzaSyAfmmOmURorl5LsFTBEWEduz_RZxW-rhjs",
  authDomain: "arbeitsplanstudis.firebaseapp.com",
  databaseURL: "https://arbeitsplanstudis-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "arbeitsplanstudis",
  storageBucket: "arbeitsplanstudis.firebasestorage.app",
  messagingSenderId: "195920059046",
  appId: "1:195920059046:web:d38519d0128c71848eb267"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ========== KONSTANTEN ==========
const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const DAYS_DE = ["Mo","Di","Mi","Do","Fr"];

const ZUERCHER_FEIERTAGE = {
  "2025": ["2025-01-01","2025-01-02","2025-04-18","2025-04-21","2025-05-01","2025-05-29","2025-06-09","2025-08-01","2025-09-15","2025-12-25","2025-12-26"],
  "2026": ["2026-01-01","2026-01-02","2026-04-03","2026-04-06","2026-05-01","2026-05-14","2026-05-25","2026-08-03","2026-09-14","2026-12-25","2026-12-26"],
};

const USER_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B88B", "#ABEBC6",
  "#F1948A", "#7DCEA0", "#85C1E2", "#D7BDE2", "#F9E79F"
];

// ========== HELPER FUNKTIONEN ==========
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

function getUserColor(username, allUsers) {
  const index = allUsers.findIndex(u => u.username === username);
  return index >= 0 ? USER_COLORS[index % USER_COLORS.length] : "#CCCCCC";
}

export function getFixedPlanSummary(plan, planFixed, username) {
  return Object.entries(planFixed)
    .filter(([, isFixed]) => isFixed)
    .map(([monthKey]) => {
      const [year, month] = monthKey.split('-').map(Number);
      const dates = Object.entries(plan)
        .filter(([dateStr, assignedUser]) => {
          return assignedUser === username && dateStr.startsWith(`${year}-${String(month).padStart(2, '0')}-`);
        })
        .map(([dateStr]) => dateStr)
        .sort((a, b) => a.localeCompare(b));

      return {
        monthKey,
        year,
        month: month - 1,
        dates,
      };
    })
    .filter(({ dates }) => dates.length > 0)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

// ========== FIREBASE DATA ACCESS ==========
async function saveToFirebase(path, data) {
  try {
    await set(ref(db, path), data);
  } catch (error) {
    console.error("Firebase save error:", error);
  }
}

async function loadFromFirebase(path) {
  try {
    const snapshot = await get(ref(db, path));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error("Firebase load error:", error);
    return null;
  }
}

function subscribeToFirebase(path, callback) {
  const dataRef = ref(db, path);
  return onValue(dataRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  });
}

// ========== MAIN APP ==========
export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [availability, setAvailability] = useState({});
  const [plan, setPlan] = useState({});
  const [planFixed, setPlanFixed] = useState({});
  const [activeTab, setActiveTab] = useState("availability");

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // ========== AUTH LISTENER ==========
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userData = await loadFromFirebase(`users/${user.uid}`);
        if (userData) {
          setCurrentUser({ ...userData, uid: user.uid });
          setAuthUser(user);
          setView("app");
        } else {
          signOut(auth);
          setAuthUser(null);
          setView("login");
        }
      } else {
        setAuthUser(null);
        setCurrentUser(null);
        setView("login");
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // ========== LOAD SHARED DATA FROM FIREBASE ==========
  useEffect(() => {
    if (!authUser) return;

    const usersUnsub = subscribeToFirebase("users", (data) => {
      if (data) {
        const usersList = Object.entries(data).map(([uid, userData]) => ({
          ...userData,
          uid
        }));
        setUsers(usersList);
      }
    });

    const availUnsub = subscribeToFirebase("availability", (data) => {
      if (data) setAvailability(data);
    });

    const planUnsub = subscribeToFirebase("plan", (data) => {
      if (data) setPlan(data);
    });

    const fixedUnsub = subscribeToFirebase("planFixed", (data) => {
      if (data) setPlanFixed(data);
    });

    return () => {
      usersUnsub();
      availUnsub();
      planUnsub();
      fixedUnsub();
    };
  }, [authUser]);

  if (loading) {
    return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",fontSize:16}}>Lädt...</div>;
  }

  if (view === "login") {
    return <LoginRegisterView setView={setView} />;
  }

  const isAdmin = currentUser?.role === "admin";
  const currentUserHouse = currentUser?.house || "USZ";
  const todayStr = toDateStr(currentYear, currentMonth, today.getDate());
  const appTitle = currentUserHouse === "Triemli" ? "Triemli Arbeitsplan" : "USZeit";

  return (
    <div style={{padding:"1.5rem",maxWidth:"1400px",margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
        <h1 style={{fontSize:24,fontWeight:500,margin:0}}>{appTitle}</h1>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:13,color:"var(--color-text-secondary)"}}>👤 {currentUser?.name}</span>
          {isAdmin && <span style={{fontSize:12,padding:"2px 8px",background:"var(--color-background-secondary)",borderRadius:4}}>Admin</span>}
          <button onClick={() => signOut(auth)} style={{fontSize:13,padding:"4px 10px"}}>Abmelden</button>
        </div>
      </div>

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
          setAvailability={setAvailability}
          currentYear={currentYear}
          currentMonth={currentMonth}
          currentUserHouse={currentUserHouse}
        />
      )}

      {activeTab === "schedule" && (
        <ScheduleView
          users={users}
          currentUser={currentUser}
          isAdmin={isAdmin}
          plan={plan}
          setPlan={setPlan}
          planFixed={planFixed}
          setPlanFixed={setPlanFixed}
          availability={availability}
          currentYear={currentYear}
          currentMonth={currentMonth}
          today={today}
          todayStr={todayStr}
        />
      )}

      {activeTab === "overview" && isAdmin && (
        <OverviewView users={users} plan={plan} currentYear={currentYear} />
      )}

      {activeTab === "profile" && !isAdmin && (
        <ProfileView currentUser={currentUser} plan={plan} today={today} currentYear={currentYear} currentMonth={currentMonth} />
      )}

      {activeTab === "admin" && isAdmin && (
        <AdminToolsView users={users} setUsers={setUsers} />
      )}

      {activeTab === "history" && (
        <HistoryView plan={plan} users={users} currentUser={currentUser} currentYear={currentYear} currentMonth={currentMonth} isAdmin={isAdmin} />
      )}
    </div>
  );
}

// ========== LOGIN / REGISTER COMPONENT ==========
function LoginRegisterView({ setView }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [house, setHouse] = useState("USZ");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setView("login");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleRegister() {
    setError("");
    if (!name || !username || !email || !password) {
      setError("Alle Felder ausfüllen.");
      return;
    }
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      const userData = {
        uid: user.uid,
        email,
        name,
        username,
        house,
        role: "user",
        archived: false
      };
      await saveToFirebase(`users/${user.uid}`, userData);
      setError("");
      setMode("login");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div style={{maxWidth:360,margin:"2rem auto",padding:"1.5rem",background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)"}}>
      <h2 style={{fontSize:18,fontWeight:500,marginBottom:16}}>
        {mode === "login" ? "Anmelden" : "Registrieren"}
      </h2>

      {mode === "login" ? (
        <>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{width:"100%",marginBottom:8,boxSizing:"border-box",padding:"8px",border:"0.5px solid var(--color-border-tertiary)",borderRadius:4}} />
          <input type="password" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)} style={{width:"100%",marginBottom:8,boxSizing:"border-box",padding:"8px",border:"0.5px solid var(--color-border-tertiary)",borderRadius:4}} />
        </>
      ) : (
        <>
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={{width:"100%",marginBottom:8,boxSizing:"border-box",padding:"8px",border:"0.5px solid var(--color-border-tertiary)",borderRadius:4}} />
          <input placeholder="Benutzername" value={username} onChange={e => setUsername(e.target.value)} style={{width:"100%",marginBottom:8,boxSizing:"border-box",padding:"8px",border:"0.5px solid var(--color-border-tertiary)",borderRadius:4}} />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{width:"100%",marginBottom:8,boxSizing:"border-box",padding:"8px",border:"0.5px solid var(--color-border-tertiary)",borderRadius:4}} />
          <input type="password" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)} style={{width:"100%",marginBottom:8,boxSizing:"border-box",padding:"8px",border:"0.5px solid var(--color-border-tertiary)",borderRadius:4}} />
          <select value={house} onChange={e => setHouse(e.target.value)} style={{width:"100%",marginBottom:8,boxSizing:"border-box",padding:"8px",border:"0.5px solid var(--color-border-tertiary)",borderRadius:4}}>
            <option value="USZ">USZ</option>
            <option value="Triemli">Triemli</option>
          </select>
        </>
      )}

      {error && <p style={{color:"var(--color-text-danger)",fontSize:13,margin:"8px 0"}}>{error}</p>}

      <button onClick={mode === "login" ? handleLogin : handleRegister} disabled={loading} style={{width:"100%",marginBottom:8,padding:"8px",background:"#639922",color:"white",border:"none",borderRadius:4,cursor:"pointer"}}>
        {loading ? "Lädt..." : (mode === "login" ? "Anmelden" : "Konto erstellen")}
      </button>

      <button onClick={() => setMode(mode === "login" ? "register" : "login")} style={{width:"100%",background:"none",border:"none",color:"var(--color-text-info)",cursor:"pointer",fontSize:14}}>
        {mode === "login" ? "Noch kein Konto? Registrieren" : "Zurück zum Login"}
      </button>
    </div>
  );
}

// ========== AVAILABILITY VIEW ==========
function AvailabilityView({ users, currentUser, isAdmin, availability, setAvailability, currentYear, currentMonth, currentUserHouse }) {
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);

  function getUserAvail(username, year, month) {
    const key = `${username}_${year}_${month}`;
    return availability[key] || {};
  }

  async function toggleAvail(dateStr, year, month) {
    if (!currentUser) return;

    const key = `${currentUser.username}_${year}_${month}`;
    const avail = availability[key] || {};
    const cur = avail[dateStr] || 0;
    const next = cur === 0 ? 2 : cur === 2 ? 1 : 0;

    const newAvail = {...avail, [dateStr]: next};
    const newAvailability = {...availability, [key]: newAvail};
    setAvailability(newAvailability);
    await saveToFirebase(`availability/${key}`, newAvail);
  }

  const houseUsers = users.filter(u => u.house === currentUserHouse && !u.archived);
  const nonAdminUsers = houseUsers.filter(u => u.role !== "admin");
  const displayUsers = isAdmin ? nonAdminUsers : [currentUser];
  const workdays = getWorkdaysInMonth(year, month);

  // Pensum-Tracker Daten
  const trackerUsers = displayUsers.map(user => {
    const userAvail = getUserAvail(user.username, year, month);
    const greenDays = Object.values(userAvail).filter(v => v === 2).length;
    const yellowDays = Object.values(userAvail).filter(v => v === 1).length;
    return {
      ...user,
      greenDays,
      yellowDays,
      percent: workdays.length > 0 ? Math.round((greenDays / workdays.length) * 100) : 0,
    };
  });

  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:"1.5rem",alignItems:"center",flexWrap:"wrap"}}>
        <select value={year} onChange={e=>setYear(parseInt(e.target.value))} style={{fontSize:14,padding:"6px 12px"}}>
          {[currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e=>setMonth(parseInt(e.target.value))} style={{fontSize:14,padding:"6px 12px"}}>
          {[...Array(12)].map((_, i) => <option key={i} value={i}>{MONTHS_DE[i]}</option>)}
        </select>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"minmax(0, 1.8fr) minmax(280px, 1fr)",gap:"1.5rem",alignItems:"start"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:"1.5rem"}}>
          {displayUsers.map(user => (
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

        <PensumTracker
          users={trackerUsers}
          targetDays={Math.max(1, Math.round(workdays.length * 0.2))}
          workdays={workdays.length}
          monthLabel={MONTHS_DE[month]}
          year={year}
        />
      </div>
    </div>
  );
}

function PensumTracker({ users, targetDays, workdays, monthLabel, year }) {
  return (
    <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12,marginBottom:12}}>
        <div>
          <h3 style={{fontSize:15,fontWeight:500,marginBottom:4}}>Pensum-Tracker</h3>
          <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{monthLabel} {year}</div>
        </div>
        <div style={{fontSize:12,padding:"4px 8px",background:"var(--color-background-secondary)",borderRadius:999}}>
          Ziel: {targetDays} Tage
        </div>
      </div>

      <div style={{display:"grid",gap:12}}>
        {users.map(user => {
          const progress = Math.min((user.greenDays / targetDays) * 100, 100);
          const status = user.greenDays >= targetDays ? "✓ Erreicht" : user.greenDays >= targetDays * 0.8 ? "~ Nahe dran" : "○ Noch nicht";

          return (
            <div key={user.username} style={{padding:"10px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:8}}>
                <div>
                  <div style={{fontWeight:500,fontSize:14}}>{user.name}</div>
                  <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{user.greenDays}🟢 {user.yellowDays}🟡</div>
                </div>
                <div style={{fontSize:12,fontWeight:500,color: user.greenDays >= targetDays ? "#2f5d18" : "#8b5e00"}}>
                  {user.percent}%
                </div>
              </div>

              <div style={{height:10,borderRadius:999,background:"#dfe8ca",overflow:"hidden",marginBottom:8}}>
                <div style={{width:`${progress}%`,height:"100%",background:user.greenDays >= targetDays ? "#5f8b3f" : "#8fb55e"}} />
              </div>

              <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                {status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== HELPER: PLAN GENERIERUNG FÜR FREIE TAGE ==========
function generatePlanForFreeDaysOnly(
  plan,
  availability,
  users,
  year,
  month,
  getWorkdaysInMonth
) {
  const workdays = getWorkdaysInMonth(year, month);
  const allUsers = users.filter(u => u.role !== "admin" && !u.archived);

  if (allUsers.length === 0) return null;

  const newPlan = { ...plan };
  const userCounts = {};
  const maxDaysPerUser = 4;

  allUsers.forEach(u => {
    const existing = Object.entries(plan).filter(([ds, username]) => {
      const [y, m] = ds.split('-').map(Number);
      return username === u.username && y === year && m === month + 1;
    }).length;
    userCounts[u.username] = existing;
  });

  const weekGroups = {};
  workdays.forEach(ds => {
    const date = new Date(ds + "T00:00:00");
    const weekNum = Math.ceil((date - new Date(date.getFullYear(), 0, 1)) / 86400000 / 7);
    if (!weekGroups[weekNum]) weekGroups[weekNum] = [];
    weekGroups[weekNum].push(ds);
  });

  Object.keys(weekGroups)
    .sort((a, b) => a - b)
    .forEach(weekNum => {
      const daysInWeek = weekGroups[weekNum];
      const freeDaysInWeek = daysInWeek.filter(ds => !newPlan[ds]);

      if (freeDaysInWeek.length === 0) return;

      const targetDay = freeDaysInWeek[0];

      let candidates = allUsers.filter(u => {
        const key = `${u.username}_${year}_${month}`;
        const avail = availability[key] || {};
        return (avail[targetDay] || 0) > 0 && userCounts[u.username] < maxDaysPerUser;
      });

      if (candidates.length === 0) return;

      candidates.sort((a, b) => userCounts[a.username] - userCounts[b.username]);
      const chosen = candidates[0];
      newPlan[targetDay] = chosen.username;
      userCounts[chosen.username]++;
    });

  workdays.forEach(ds => {
    if (newPlan[ds]) return;

    let candidates = allUsers.filter(u => {
      const key = `${u.username}_${year}_${month}`;
      const avail = availability[key] || {};
      return (avail[ds] || 0) > 0 && userCounts[u.username] < maxDaysPerUser;
    });

    if (candidates.length === 0) return;

    candidates.sort((a, b) => {
      const countDiff = userCounts[a.username] - userCounts[b.username];
      if (countDiff !== 0) return countDiff;

      const key_a = `${a.username}_${year}_${month}`;
      const key_b = `${b.username}_${year}_${month}`;
      const avA = (availability[key_a] || {})[ds] || 0;
      const avB = (availability[key_b] || {})[ds] || 0;
      if (avB !== avA) return avB - avA;

      return a.name.localeCompare(b.name);
    });

    const chosen = candidates[0];
    newPlan[ds] = chosen.username;
    userCounts[chosen.username]++;
  });

  return newPlan;
}

// ========== SCHEDULE VIEW ==========
function ScheduleView({ users, currentUser, isAdmin, plan, setPlan, planFixed, setPlanFixed, availability, currentYear, currentMonth, today, todayStr }) {
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [editMode, setEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const isMonthFixed = planFixed[monthKey] || false;
  const canEdit = isAdmin && !isMonthFixed;
  const workdays = getWorkdaysInMonth(year, month);

  const planUsers = users.filter(u => u.role !== "admin" && !u.archived);
  const planStats = planUsers.map(user => {
    const plannedDays = Object.entries(plan).filter(([dateStr, username]) => {
      const [planYear, planMonth] = dateStr.split('-').map(Number);
      return username === user.username && planYear === year && planMonth === month + 1;
    }).length;

    const percentage = workdays.length > 0 ? Math.round((plannedDays / workdays.length) * 100) : 0;
    const delta = percentage - 20;
    const status = percentage < 10 ? "unter Ziel" : percentage > 30 ? "über Ziel" : "im Zielbereich";

    return {
      ...user,
      plannedDays,
      percentage,
      delta,
      status,
    };
  });
  const fixedPlanSummary = !isAdmin && currentUser
    ? getFixedPlanSummary(plan, planFixed, currentUser.username)
    : [];

  async function generatePlan() {
    const allUsersForPlan = users.filter(u => u.role !== "admin" && !u.archived);
    if (allUsersForPlan.length === 0) {
      alert("Keine Benutzer vorhanden.");
      return;
    }

    const newPlan = {};
    const userCounts = {};
    const preferredDaysPerUser = 4;
    const maxDaysPerUser = 5;
    const target = Math.min(Math.round(workdays.length * 0.2), preferredDaysPerUser);

    allUsersForPlan.forEach(u => {
      userCounts[u.username] = 0;
    });

    workdays.forEach((ds) => {
      let candidates = allUsersForPlan.filter(u => {
        const key = `${u.username}_${year}_${month}`;
        const avail = availability[key] || {};
        return (avail[ds] || 0) > 0 && userCounts[u.username] < maxDaysPerUser;
      });

      candidates = candidates.sort((a, b) => {
        const gapA = target - userCounts[a.username];
        const gapB = target - userCounts[b.username];
        if (gapB !== gapA) return gapB - gapA;

        const key_a = `${a.username}_${year}_${month}`;
        const key_b = `${b.username}_${year}_${month}`;
        const avA = (availability[key_a] || {})[ds] || 0;
        const avB = (availability[key_b] || {})[ds] || 0;
        if (avB !== avA) return avB - avA;

        return a.name.localeCompare(b.name);
      });

      if (candidates.length > 0) {
        const chosen = candidates[0];
        newPlan[ds] = chosen.username;
        userCounts[chosen.username]++;
      }
    });

    const updatedPlan = mergePlanData(plan, newPlan);
    setPlan(updatedPlan);
    await saveToFirebase("plan", updatedPlan);
    alert(`Plan für ${MONTHS_DE[month]} ${year} erstellt!`);
  }

  async function addServiceDay(dateStr, username) {
    const updatedPlan = mergePlanData(plan, { [dateStr]: username });
    setPlan(updatedPlan);
    await saveToFirebase("plan", updatedPlan);
  }

  async function removeServiceDay(dateStr) {
    const updatedPlan = { ...plan };
    delete updatedPlan[dateStr];
    setPlan(updatedPlan);
    await saveToFirebase("plan", updatedPlan);
  }

  async function togglePlanFixed() {
    const updatedFixed = mergePlanFixedData(planFixed, monthKey, !isMonthFixed);
    setPlanFixed(updatedFixed);
    await saveToFirebase("planFixed", updatedFixed);
  }

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
          <button onClick={generatePlan} style={{fontSize:14,padding:"6px 12px",background:"#639922",color:"white",border:"none",borderRadius:4,cursor:"pointer"}}>
            Plan generieren
          </button>
        )}

        {isAdmin && (
          <button onClick={togglePlanFixed} style={{fontSize:14,padding:"6px 12px",background:isMonthFixed ? "#d13438" : "#0078D4",color:"white",border:"none",borderRadius:4,cursor:"pointer"}}>
            {isMonthFixed ? "🔒 Entsperren" : "🔓 Fixieren"}
          </button>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns: isAdmin ? "minmax(0, 2fr) minmax(300px, 1fr)" : "1fr",gap:"1.5rem",alignItems:"start"}}>
        <div style={{display:"grid",gap:"1rem"}}>
          {!isAdmin && fixedPlanSummary.length > 0 && (
            <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
              <h3 style={{fontSize:15,fontWeight:500,marginBottom:8}}>Meine fixierten Arbeitstage</h3>
              <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:12}}>
                Deine Arbeitstage für fixierte Monate sind hier monatlich zusammengefasst.
              </p>
              <div style={{display:"grid",gap:10}}>
                {fixedPlanSummary.map(({ monthKey, year, month, dates }) => (
                  <div key={monthKey} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"0.85rem"}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:8,alignItems:"baseline"}}>
                      <div style={{fontSize:14,fontWeight:500}}>{MONTHS_DE[month]} {year}</div>
                      <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{dates.length} Arbeitstage</div>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {dates.map((dateStr) => (
                        <span key={dateStr} style={{fontSize:12,padding:"4px 8px",borderRadius:999,background:"white",border:"1px solid var(--color-border-tertiary)",color:"var(--color-text-primary)"}}>
                          {dateStr.slice(8)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <MonthSchedule
            year={year}
            month={month}
            plan={plan}
            users={users}
            workdays={workdays}
            canEdit={canEdit}
            isAdmin={isAdmin}
            currentUser={currentUser}
            addServiceDay={addServiceDay}
            removeServiceDay={removeServiceDay}
            todayStr={todayStr}
            editMode={editMode}
            setEditMode={setEditMode}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
          />
        </div>

        {isAdmin && (
          <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
            <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Live-Tracker</h3>
            <p style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:12}}>
              Aktualisiert in Echtzeit
            </p>

            <div style={{display:"grid",gap:10}}>
              {planStats.map(user => {
                const barColor = user.percentage >= 20 ? "#5f8b3f" : "#8fb55e";
                const statusColor = user.percentage < 10 || user.percentage > 30 ? "#d13438" : "#639922";

                return (
                  <div key={user.username} style={{padding:"10px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:8}}>
                      <div>
                        <div style={{fontWeight:500,fontSize:14}}>{user.name}</div>
                        <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{user.plannedDays} Tage</div>
                      </div>
                      <div style={{fontSize:12,fontWeight:500,color:statusColor}}>
                        {user.percentage}%
                      </div>
                    </div>

                    <div style={{height:10,borderRadius:999,background:"#dfe8ca",overflow:"hidden",marginBottom:8}}>
                      <div style={{width:`${Math.min(user.percentage, 30)}%`,height:"100%",background:barColor}} />
                    </div>

                    <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                      {user.status}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========== OVERVIEW VIEW ==========
function OverviewView({ users, plan, currentYear }) {
  function getMonthPensum(username, year, month) {
    const wds = getWorkdaysInMonth(year, month).length;
    const planned = Object.entries(plan).filter(([ds, u]) => {
      const [y, m] = ds.split('-').map(Number);
      return u === username && y === year && m === (month + 1);
    }).length;
    return wds > 0 ? planned / wds : 0;
  }

  const nonAdminUsers = users.filter(u => u.role !== "admin");

  return (
    <div>
      <h2 style={{fontSize:18,fontWeight:500,marginBottom:"1.5rem"}}>Übersicht</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:"1.5rem"}}>
        {nonAdminUsers.map(user => (
          <div key={user.username} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
            <h3 style={{fontSize:16,fontWeight:500,marginBottom:12}}>{user.name}</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:4}}>
              {[...Array(12)].map((_, i) => {
                const pensum = getMonthPensum(user.username, currentYear, i);
                const color = pensum < 0.15 || pensum > 0.25 ? "#d13438" : "#639922";
                return (
                  <div key={i} style={{padding:"4px",background:"var(--color-background-secondary)",borderRadius:3,fontSize:11,textAlign:"center",borderLeft:`3px solid ${color}`}}>
                    <div>{MONTHS_DE[i].slice(0,3)}</div>
                    <div style={{fontWeight:500}}>{Math.round(pensum * 100)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== PROFILE VIEW ==========
function ProfileView({ currentUser, plan, today, currentYear, currentMonth }) {
  const futureDays = Object.entries(plan)
    .filter(([dateStr, username]) => {
      if (username !== currentUser?.username) return false;
      const dayDate = new Date(dateStr + "T00:00:00");
      return dayDate > today;
    })
    .sort((a, b) => new Date(a[0]) - new Date(b[0]));

  return (
    <div>
      <h2 style={{fontSize:18,fontWeight:500,marginBottom:"1.5rem"}}>Mein Profil - {currentUser?.name}</h2>
      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
        <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Zukünftige Arbeitstage</h3>
        {futureDays.length === 0 ? (
          <p style={{fontSize:13,color:"var(--color-text-secondary)"}}>Keine zukünftigen Arbeitstage eingeplant.</p>
        ) : (
          futureDays.map(([dateStr], idx) => (
            <div key={idx} style={{fontSize:13,padding:"8px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
              <strong>{dateStr}</strong>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ========== ADMIN TOOLS VIEW ==========
function AdminToolsView({ users, setUsers }) {
  async function toggleArchive(uid) {
    const user = users.find(u => u.uid === uid);
    if (!user) return;
    const updated = {...user, archived: !user.archived};
    setUsers(users.map(u => u.uid === uid ? updated : u));
    await saveToFirebase(`users/${uid}`, updated);
  }

  const activeUsers = users.filter(u => !u.archived);
  const archivedUsers = users.filter(u => u.archived);

  return (
    <div>
      <h2 style={{fontSize:18,fontWeight:500,marginBottom:"1.5rem"}}>Admin-Tools</h2>

      <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem",marginBottom:"1.5rem"}}>
        <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Aktive Benutzer ({activeUsers.length})</h3>
        {activeUsers.map(u => (
          <div key={u.uid} style={{padding:"10px",background:"var(--color-background-secondary)",borderRadius:4,marginBottom:8,display:"flex",justifyContent:"space-between"}}>
            <div>
              <div style={{fontWeight:500}}>{u.name}</div>
              <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>@{u.username} • {u.house}</div>
            </div>
            <button onClick={() => toggleArchive(u.uid)} style={{fontSize:11,padding:"4px 8px",background:"#FFC107",color:"white",border:"none",borderRadius:3,cursor:"pointer"}}>
              📦 Archiv
            </button>
          </div>
        ))}
      </div>

      {archivedUsers.length > 0 && (
        <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
          <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Archivierte Benutzer ({archivedUsers.length})</h3>
          {archivedUsers.map(u => (
            <div key={u.uid} style={{padding:"10px",background:"var(--color-background-secondary)",borderRadius:4,marginBottom:8,display:"flex",justifyContent:"space-between",opacity:0.6}}>
              <div>
                <div style={{fontWeight:500}}>{u.name}</div>
              </div>
              <button onClick={() => toggleArchive(u.uid)} style={{fontSize:11,padding:"4px 8px",background:"#639922",color:"white",border:"none",borderRadius:3,cursor:"pointer"}}>
                ↩️ Reaktivieren
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== HISTORY VIEW ==========
function HistoryView({ plan, users, currentUser, currentYear, currentMonth, isAdmin }) {
  const today = new Date();

  const monthPlans = {};
  Object.entries(plan).forEach(([dateStr, username]) => {
    const [y, m] = dateStr.split('-').map(Number);
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    if (!monthPlans[monthKey]) monthPlans[monthKey] = [];
    monthPlans[monthKey].push({ date: dateStr, user: username });
  });

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
              const myDays = entries.filter(e => e.user === currentUser?.username);
              if (myDays.length === 0) return null;

              return (
                <div key={monthKey} style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
                  <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>📅 {MONTHS_DE[month - 1]} {year}</h3>
                  <div>
                    {myDays.map((e, idx) => (
                      <div key={idx} style={{fontSize:13,padding:"6px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
                        <strong>{e.date}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

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

// ========== CALENDAR COMPONENTS ==========
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

            let bg = "#f7faf1";
            let color = "var(--color-text-primary)";

            if (!isWorkday) {
              bg = "#eef2e3";
              color = "var(--color-text-tertiary)";
            } else if (val === 2) {
              bg = "#dcecc3";
              color = "#2f5d18";
            } else if (val === 1) {
              bg = "#fff1c8";
              color = "#7f5f16";
            }

            return (
              <div
                key={di}
                onClick={() => isWorkday && !readOnly && onToggle && onToggle(ds)}
                style={{background:bg,color,border:"1px solid #dfe8ca",borderRadius:4,padding:"4px 2px",textAlign:"center",fontSize:11,fontWeight:500,cursor: isWorkday && !readOnly ? "pointer" : "default",minHeight:28,display:"flex",alignItems:"center",justifyContent:"center"}}
              >
                {d}
              </div>
            );
          })}
        </div>
      ))}

      <div style={{display:"flex",gap:8,marginTop:8,fontSize:11,color:"var(--color-text-secondary)"}}>
        <span style={{background:"#dcecc3",color:"#2f5d18",padding:"2px 6px",borderRadius:3}}>● {greenDays} grün</span>
        <span style={{background:"#fff1c8",color:"#7f5f16",padding:"2px 6px",borderRadius:3}}>● {yellowDays} gelb</span>
      </div>
    </div>
  );
}

function MonthSchedule({ year, month, plan, users, workdays, canEdit, isAdmin, currentUser, addServiceDay, removeServiceDay, todayStr, editMode, setEditMode, selectedUser, setSelectedUser }) {
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

  const allUsers = users.filter(u => u.role !== "admin" && !u.archived);

  return (
    <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem"}}>
      <h3 style={{fontSize:15,fontWeight:500,marginBottom:12}}>Plan {MONTHS_DE[month]} {year}</h3>

      {canEdit && editMode && (
        <div style={{background:"var(--color-background-secondary)",padding:"10px",borderRadius:4,marginBottom:12}}>
          <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} style={{fontSize:12,marginBottom:8,padding:"4px 8px",width:"100%"}}>
            <option value="">Mitarbeiter auswählen</option>
            {allUsers.map(u => <option key={u.username} value={u.username}>{u.name}</option>)}
          </select>
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
            const userColor = user ? getUserColor(user.username, allUsers) : "transparent";

            let bg = "#f7faf1";
            let color = "var(--color-text-primary)";
            let border = isToday ? "3px solid #0078D4" : "1px solid #dfe8ca";

            if (!isWorkday) {
              bg = "#eef2e3";
              color = "var(--color-text-tertiary)";
              border = "1px dashed #cfd9b9";
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
                  } else if (canEdit && editMode && assignedUser) {
                    removeServiceDay(ds);
                  }
                }}
                style={{background:bg,color,border,borderRadius:4,padding:"6px 2px",textAlign:"center",fontSize:11,fontWeight:500,cursor: isWorkday ? "pointer" : "default",minHeight:50,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}
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
  );
}