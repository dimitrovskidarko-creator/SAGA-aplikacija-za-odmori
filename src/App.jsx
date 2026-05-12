import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://iynyzhiyddexvpxmodxi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bnl6aGl5ZGRleHZweG1vZHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTk3NjYsImV4cCI6MjA5Mjk5NTc2Nn0.V0_R1YPyCvKAqvE50J-oafL4lRXgnWOtsIPzwZcgyRU'
)

const VERSION = 'v1.12'
const APP_NAME = 'SAGA апликација за одмори'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [role, setRole] = useState('')
  const [fullName, setFullName] = useState('')

  const [loginEmail, setLoginEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [employees, setEmployees] = useState([])
  const [leaves, setLeaves] = useState([])
  const [myEmployee, setMyEmployee] = useState(null)

  const [newEmpName, setNewEmpName] = useState('')
  const [newEmpEmail, setNewEmpEmail] = useState('')
  const [newEmpTotalDays, setNewEmpTotalDays] = useState(20)

  const [manualEmployeeId, setManualEmployeeId] = useState('')
  const [manualStartDate, setManualStartDate] = useState('')
  const [manualEndDate, setManualEndDate] = useState('')
  const [manualReason, setManualReason] = useState('Нејавено отсуство')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('Одмор')
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadAll(data.session.user)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) loadAll(newSession.user)
      else reset()
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  function reset() {
    setRole('')
    setFullName('')
    setEmployees([])
    setLeaves([])
    setMyEmployee(null)
  }

  async function loadAll(user) {
    await loadProfile(user)
    await loadEmployees(user.email)
    await loadLeaves()
  }

  async function loadProfile(user) {
    const { data } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    setRole(data?.role || 'employee')
    setFullName(data?.full_name || user.email)
  }

  async function loadEmployees(userEmail) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('full_name', { ascending: true })

    if (error) return alert(error.message)

    setEmployees(data || [])
    setMyEmployee((data || []).find((e) => e.email === userEmail) || null)
  }

  async function loadLeaves() {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .order('start_date', { ascending: true })

    if (error) return alert(error.message)
    setLeaves(data || [])
  }

  async function login() {
    if (!loginEmail || !password) return alert('Внеси email и лозинка')

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error) alert(error.message)
  }

  async function resetPassword() {
    if (!loginEmail) return alert('Внеси email адреса')

    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: window.location.origin,
    })

    if (error) return alert(error.message)

    alert('Испратен е email за ресетирање лозинка ✅')
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 6) {
      return alert('Новата лозинка мора да има минимум 6 карактери')
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) return alert(error.message)

    alert('Лозинката е променета ✅')
    setNewPassword('')
  }

  async function logout() {
    await supabase.auth.signOut()
    localStorage.clear()
    sessionStorage.clear()
    setSession(null)
    window.location.href = '/'
  }

  function countDays(start, end) {
    const s = new Date(start)
    const e = new Date(end)
    return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1
  }

  function shouldDeductLeaveDays(reasonValue) {
    return reasonValue !== 'Боледување'
  }

  async function addEmployee() {
    if (role !== 'hr') return alert('Само HR може да додава')
    if (!newEmpName || !newEmpEmail) return alert('Внеси име и email')

    const { error } = await supabase.from('employees').insert({
      full_name: newEmpName,
      email: newEmpEmail,
      leave_days_total: Number(newEmpTotalDays || 20),
      leave_days_used: 0,
    })

    if (error) return alert(error.message)

    alert('Вработениот е додаден ✅')
    setNewEmpName('')
    setNewEmpEmail('')
    setNewEmpTotalDays(20)
    await loadEmployees(session.user.email)
  }

  async function deleteEmployee(emp) {
    if (role !== 'hr') return alert('Само HR може да брише')

    const ok = window.confirm(`Дали сигурно сакаш да го избришеш ${emp.full_name}?`)
    if (!ok) return

    await supabase.from('leave_requests').delete().eq('employee_id', emp.id)

    const { error } = await supabase.from('employees').delete().eq('id', emp.id)

    if (error) return alert(error.message)

    alert('Вработениот е избришан ✅')
    await loadEmployees(session.user.email)
    await loadLeaves()
  }

  async function recordManualLeave() {
    if (!manualEmployeeId) return alert('Избери вработен')
    if (!manualStartDate || !manualEndDate) return alert('Избери датуми')
    if (manualEndDate < manualStartDate) return alert('Крајниот датум не може да биде пред почетниот')

    const emp = employees.find((e) => e.id === manualEmployeeId)
    if (!emp) return alert('Вработениот не е пронајден')

    const finalReason = manualReason || 'Нејавено отсуство'
    const days = countDays(manualStartDate, manualEndDate)

    const { error } = await supabase.from('leave_requests').insert({
      employee_id: emp.id,
      start_date: manualStartDate,
      end_date: manualEndDate,
      reason: finalReason,
      status: 'approved',
      approved_by: fullName,
    })

    if (error) return alert(error.message)

    if (shouldDeductLeaveDays(finalReason)) {
      await supabase
        .from('employees')
        .update({
          leave_days_used: Number(emp.leave_days_used || 0) + days,
        })
        .eq('id', emp.id)
    }

    alert('Отсуството е внесено ✅')

    setManualEmployeeId('')
    setManualStartDate('')
    setManualEndDate('')
    setManualReason('Нејавено отсуство')

    await loadEmployees(session.user.email)
    await loadLeaves()
  }

  async function submitLeaveRequest() {
    if (!myEmployee?.id) return alert('Нема employee запис')
    if (!startDate || !endDate) return alert('Избери датуми')
    if (endDate < startDate) return alert('Крајниот датум не може да биде пред почетниот')

    const { error } = await supabase.from('leave_requests').insert({
      employee_id: myEmployee.id,
      start_date: startDate,
      end_date: endDate,
      reason,
      status: 'pending',
      approved_by: null,
    })

    if (error) return alert(error.message)

    alert('Барањето е испратено ✅')

    setStartDate('')
    setEndDate('')
    setReason('Одмор')
    await loadLeaves()
  }

  async function updateLeaveStatus(leave, status) {
    const emp = employees.find((e) => e.id === leave.employee_id)
    const leaveReason = leave.reason || 'Одмор'

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status,
        approved_by: fullName,
      })
      .eq('id', leave.id)

    if (error) return alert(error.message)

    if (status === 'approved' && emp && shouldDeductLeaveDays(leaveReason)) {
      const days = countDays(leave.start_date, leave.end_date)

      await supabase
        .from('employees')
        .update({
          leave_days_used: Number(emp.leave_days_used || 0) + days,
        })
        .eq('id', emp.id)
    }

    await loadEmployees(session.user.email)
    await loadLeaves()
  }

  function formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  function getCalendarDays() {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    const days = []

    for (let i = 0; i < startOffset; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
    while (days.length % 7 !== 0) days.push(null)

    return days
  }

  function getLeavesForDay(day) {
    if (!day) return []
    const d = formatDate(day)
    return leaves.filter((l) => l.status === 'approved' && d >= l.start_date && d <= l.end_date)
  }

  function getEmployeeById(id) {
    return employees.find((e) => e.id === id)
  }

  const myLeaves = useMemo(() => {
    if (!myEmployee?.id) return []
    return leaves.filter((l) => l.employee_id === myEmployee.id)
  }, [leaves, myEmployee])

  const pendingLeaves = leaves.filter((l) => l.status === 'pending')
  const approvedLeaves = leaves.filter((l) => l.status === 'approved')
  const sickLeaves = leaves.filter((l) => l.status === 'approved' && l.reason === 'Боледување')

  const monthName = currentDate.toLocaleDateString('mk-MK', {
    month: 'long',
    year: 'numeric',
  })

  const todayString = formatDate(new Date())

  if (loading) return <div style={styles.center}>Loading...</div>

  if (!session) {
    return (
      <div style={styles.center}>
        <div style={styles.loginCard}>
          <h1 style={styles.loginTitle}>{APP_NAME}</h1>

          <input
            style={styles.input}
            placeholder="Email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Лозинка"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button style={styles.primaryButton} onClick={login}>
            Најави се
          </button>

          <button style={styles.secondaryButton} onClick={resetPassword}>
            Заборавена лозинка
          </button>

          <p style={styles.muted}>
            Ако прв пат се најавуваш, користи ја генеричката лозинка што ти ја дал HR.
          </p>
        </div>

        <div style={styles.version}>{VERSION}</div>
      </div>
    )
  }

  return (
    <div style={styles.app}>
      <header style={styles.navbar}>
        <h1 style={styles.appTitle}>{APP_NAME}</h1>

        <div style={styles.navRight}>
          <div style={{ textAlign: 'right' }}>
            <b>{fullName}</b>
            <div style={styles.smallMuted}>{role === 'hr' ? 'HR' : 'Вработен'}</div>
          </div>

          <button style={styles.logoutButton} onClick={logout}>
            Одјави се
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Промена на лозинка</h2>

          <input
            style={styles.input}
            type="password"
            placeholder="Нова лозинка"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <button style={styles.primaryButton} onClick={changePassword}>
            Промени лозинка
          </button>
        </section>

        {role === 'hr' && (
          <>
            <section style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statNumber}>{employees.length}</div>
                <div style={styles.statLabel}>Вработени</div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statNumber}>{pendingLeaves.length}</div>
                <div style={styles.statLabel}>Чекаат одобрување</div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statNumber}>{approvedLeaves.length}</div>
                <div style={styles.statLabel}>Одобрени отсуства</div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statNumber}>{sickLeaves.length}</div>
                <div style={styles.statLabel}>Боледувања</div>
              </div>
            </section>

            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Додај нов вработен</h2>

              <div style={styles.formGrid}>
                <input
                  style={styles.input}
                  placeholder="Име и презиме"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                />

                <input
                  style={styles.input}
                  placeholder="Email"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                />

                <input
                  style={styles.input}
                  type="number"
                  placeholder="Вкупно денови"
                  value={newEmpTotalDays}
                  onChange={(e) => setNewEmpTotalDays(e.target.value)}
                />
              </div>

              <button style={styles.primaryButton} onClick={addEmployee}>
                Додај вработен
              </button>

              <p style={styles.muted}>
                Ова додава вработен во табелата. Auth user креирај го во Supabase со генеричка лозинка.
              </p>
            </section>

            <section style={styles.card}>
              <h2 style={styles.cardTitle}>HR внес на отсуство</h2>

              <div style={styles.formGrid}>
                <select
                  style={styles.input}
                  value={manualEmployeeId}
                  onChange={(e) => setManualEmployeeId(e.target.value)}
                >
                  <option value="">Избери вработен</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>

                <select
                  style={styles.input}
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                >
                  <option value="Нејавено отсуство">Нејавено отсуство</option>
                  <option value="Одмор">Одмор</option>
                  <option value="Боледување">Боледување</option>
                </select>

                <input
                  style={styles.input}
                  type="date"
                  value={manualStartDate}
                  onChange={(e) => setManualStartDate(e.target.value)}
                />

                <input
                  style={styles.input}
                  type="date"
                  value={manualEndDate}
                  onChange={(e) => setManualEndDate(e.target.value)}
                />
              </div>

              <button style={styles.primaryButton} onClick={recordManualLeave}>
                Запиши отсуство
              </button>
            </section>
          </>
        )}

        <section style={styles.calendarCard}>
          <div style={styles.calendarTop}>
            <div style={styles.calendarTitleGroup}>
              <h2 style={styles.calendarTitle}>Календар</h2>
              <div style={styles.monthTitle}>{monthName}</div>
            </div>

            <div style={styles.calendarActions}>
              <button style={styles.secondaryButtonSmall} onClick={() => setCurrentDate(new Date())}>
                Денес
              </button>
              <button
                style={styles.roundButton}
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
              >
                ‹
              </button>
              <button
                style={styles.roundButton}
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
              >
                ›
              </button>
            </div>
          </div>

          <div style={styles.weekHeader}>
            <div>Пон</div><div>Вто</div><div>Сре</div><div>Чет</div><div>Пет</div><div>Саб</div><div>Нед</div>
          </div>

          <div style={styles.calendarGrid}>
            {getCalendarDays().map((day, index) => {
              const dayLeaves = getLeavesForDay(day)
              const isToday = day && formatDate(day) === todayString

              return (
                <div key={index} style={styles.day}>
                  {day && (
                    <>
                      <div style={{ ...styles.dayNumber, ...(isToday ? styles.todayCircle : {}) }}>
                        {day.getDate()}
                      </div>

                      <div style={styles.eventList}>
                        {dayLeaves.map((leave, i) => {
                          const emp = getEmployeeById(leave.employee_id)
                          const isSick = leave.reason === 'Боледување'

                          return (
                            <div
                              key={leave.id}
                              style={{
                                ...styles.event,
                                background: isSick ? '#1d4ed8' : getEventColor(i),
                              }}
                            >
                              {emp?.full_name || 'Вработен'} - {leave.reason || 'Одмор'}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Вработени</h2>

          <div style={styles.employeeTable}>
            <div
              style={{
                ...styles.employeeHead,
                gridTemplateColumns:
                  role === 'hr'
                    ? '1.2fr 1.8fr .7fr .8fr .8fr .8fr'
                    : '1.2fr 1.8fr .7fr .8fr .8fr',
              }}
            >
              <div>Име</div>
              <div>Email</div>
              <div>Вкупно</div>
              <div>Искористено</div>
              <div>Останато</div>
              {role === 'hr' && <div>Акција</div>}
            </div>

            {employees.map((emp) => {
              const total = Number(emp.leave_days_total || 0)
              const used = Number(emp.leave_days_used || 0)

              return (
                <div
                  key={emp.id}
                  style={{
                    ...styles.employeeRow,
                    gridTemplateColumns:
                      role === 'hr'
                        ? '1.2fr 1.8fr .7fr .8fr .8fr .8fr'
                        : '1.2fr 1.8fr .7fr .8fr .8fr',
                  }}
                >
                  <div><b>{emp.full_name || '-'}</b></div>
                  <div>{emp.email || '-'}</div>
                  <div>{total}</div>
                  <div>{used}</div>
                  <div><b>{total - used}</b></div>

                  {role === 'hr' && (
                    <div>
                      <button style={styles.rejectButton} onClick={() => deleteEmployee(emp)}>
                        Избриши
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {role === 'hr' ? (
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>Барања</h2>

            {pendingLeaves.length === 0 && <p style={styles.muted}>Нема нови барања.</p>}

            {pendingLeaves.map((leave) => {
              const emp = getEmployeeById(leave.employee_id)

              return (
                <div key={leave.id} style={styles.requestRow}>
                  <div>
                    <b>{emp?.full_name || 'Вработен'}</b>
                    <br />
                    {leave.start_date} до {leave.end_date}
                    <br />
                    <span style={leave.reason === 'Боледување' ? styles.sickText : styles.muted}>
                      {leave.reason || 'Одмор'}
                    </span>
                  </div>

                  <div style={styles.actionButtons}>
                    <button style={styles.approveButton} onClick={() => updateLeaveStatus(leave, 'approved')}>
                      Одобри
                    </button>

                    <button style={styles.rejectButton} onClick={() => updateLeaveStatus(leave, 'rejected')}>
                      Одбиј
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        ) : (
          <>
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Поднеси барање</h2>

              <div style={styles.formGrid}>
                <input
                  style={styles.input}
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />

                <input
                  style={styles.input}
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <select style={styles.input} value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="Одмор">Одмор</option>
                <option value="Боледување">Боледување</option>
              </select>

              <button style={styles.primaryButton} onClick={submitLeaveRequest}>
                Испрати барање
              </button>
            </section>

            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Мои барања</h2>

              {myLeaves.length === 0 && <p style={styles.muted}>Нема барања.</p>}

              {myLeaves.map((leave) => (
                <div key={leave.id} style={styles.requestRow}>
                  <div>
                    <b>{leave.start_date} до {leave.end_date}</b>
                    <br />
                    <span style={leave.reason === 'Боледување' ? styles.sickText : styles.muted}>
                      {leave.reason || 'Одмор'}
                    </span>
                  </div>

                  <span style={statusStyle(leave.status)}>
                    {leave.status === 'approved'
                      ? 'Одобрено'
                      : leave.status === 'rejected'
                        ? 'Одбиено'
                        : 'Се чека'}
                  </span>
                </div>
              ))}
            </section>
          </>
        )}
      </main>

      <div style={styles.version}>{VERSION}</div>
    </div>
  )
}

function getEventColor(index) {
  const colors = ['#7a2b26', '#9f3b33', '#b85c52', '#5e1f1b', '#c58b84', '#8a332e']
  return colors[index % colors.length]
}

function statusStyle(status) {
  const base = { padding: '8px 12px', borderRadius: 999, fontWeight: 700, fontSize: 13 }
  if (status === 'approved') return { ...base, background: '#e8f5e9', color: '#166534' }
  if (status === 'rejected') return { ...base, background: '#fee2e2', color: '#991b1b' }
  return { ...base, background: '#fff1d6', color: '#8a4b00' }
}

const styles = {
  center: {
    minHeight: '100vh',
    background: '#f5f1ef',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Arial, sans-serif',
  },
  app: {
    minHeight: '100vh',
    background: '#f5f1ef',
    fontFamily: 'Arial, sans-serif',
    color: '#2b1b18',
  },
  loginCard: {
    width: 390,
    background: '#fff',
    padding: 34,
    borderRadius: 22,
    border: '1px solid #eadbd8',
    boxShadow: '0 12px 30px rgba(122,43,38,.16)',
  },
  loginTitle: { marginTop: 0, color: '#7a2b26', fontSize: 26 },
  navbar: {
    height: 76,
    background: '#fff',
    borderBottom: '1px solid #eadbd8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 28px',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  appTitle: { margin: 0, color: '#7a2b26', fontSize: 24, fontWeight: 700 },
  navRight: { display: 'flex', alignItems: 'center', gap: 18 },
  smallMuted: { fontSize: 12, color: '#80645f', marginTop: 3 },
  main: { padding: 28, maxWidth: 1500, margin: '0 auto' },
  version: { position: 'fixed', bottom: 12, right: 18, fontSize: 12, color: '#80645f' },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))',
    gap: 18,
    marginBottom: 22,
  },
  statCard: {
    background: '#fff',
    border: '1px solid #eadbd8',
    borderRadius: 18,
    padding: 22,
    boxShadow: '0 2px 8px rgba(122,43,38,.10)',
  },
  statNumber: { fontSize: 34, fontWeight: 800, color: '#7a2b26' },
  statLabel: { color: '#80645f', fontSize: 14, marginTop: 4 },
  card: {
    background: '#fff',
    border: '1px solid #eadbd8',
    borderRadius: 18,
    padding: 24,
    marginBottom: 24,
    boxShadow: '0 2px 8px rgba(122,43,38,.10)',
  },
  cardTitle: { marginTop: 0, color: '#7a2b26' },
  muted: { color: '#80645f', fontSize: 13 },
  sickText: { color: '#1d4ed8', fontWeight: 700 },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 14,
  },
  input: {
    width: '100%',
    padding: '13px 14px',
    borderRadius: 10,
    border: '1px solid #d8b8b3',
    background: '#fff',
    color: '#2b1b18',
    fontSize: 15,
    boxSizing: 'border-box',
    marginTop: 10,
  },
  primaryButton: {
    padding: '13px 20px',
    borderRadius: 10,
    border: 'none',
    background: '#7a2b26',
    color: '#fff',
    fontSize: 15,
    cursor: 'pointer',
    fontWeight: 700,
    marginTop: 14,
  },
  secondaryButton: {
    width: '100%',
    padding: '12px 18px',
    borderRadius: 10,
    border: '1px solid #7a2b26',
    background: '#fff',
    color: '#7a2b26',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 10,
  },
  secondaryButtonSmall: {
    padding: '9px 16px',
    borderRadius: 8,
    border: '1px solid #d8b8b3',
    background: '#fff',
    color: '#7a2b26',
    fontWeight: 700,
    cursor: 'pointer',
  },
  logoutButton: {
    padding: '10px 16px',
    borderRadius: 10,
    border: '1px solid #7a2b26',
    background: '#fff',
    color: '#7a2b26',
    fontWeight: 700,
    cursor: 'pointer',
  },
  employeeTable: {
    width: '100%',
    overflow: 'auto',
    borderRadius: 14,
    border: '1px solid #eadbd8',
  },
  employeeHead: {
    display: 'grid',
    gap: 12,
    background: '#7a2b26',
    color: '#fff',
    padding: 14,
    fontWeight: 700,
    minWidth: 900,
  },
  employeeRow: {
    display: 'grid',
    gap: 12,
    padding: 14,
    borderTop: '1px solid #eadbd8',
    alignItems: 'center',
    background: '#fff',
    minWidth: 900,
  },
  requestRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    padding: 14,
    border: '1px solid #eadbd8',
    borderRadius: 14,
    marginBottom: 10,
    background: '#fff',
  },
  actionButtons: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  approveButton: {
    padding: '9px 14px',
    borderRadius: 10,
    border: 'none',
    background: '#188038',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  rejectButton: {
    padding: '9px 14px',
    borderRadius: 10,
    border: 'none',
    background: '#9f3b33',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  calendarCard: {
    background: '#fff',
    border: '1px solid #eadbd8',
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(122,43,38,.10)',
    marginBottom: 24,
  },
  calendarTop: {
    height: 72,
    padding: '0 22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #eadbd8',
  },
  calendarTitleGroup: { display: 'flex', alignItems: 'baseline', gap: 18 },
  calendarTitle: { margin: 0, color: '#2b1b18', fontSize: 22, fontWeight: 600 },
  monthTitle: { color: '#80645f', fontSize: 18, textTransform: 'capitalize' },
  calendarActions: { display: 'flex', alignItems: 'center', gap: 10 },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: '#f8f3f1',
    color: '#7a2b26',
    fontSize: 24,
    cursor: 'pointer',
  },
  weekHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    borderBottom: '1px solid #eadbd8',
    background: '#fff',
    color: '#80645f',
    fontSize: 13,
    fontWeight: 700,
    textAlign: 'center',
    padding: '10px 0',
  },
  calendarGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' },
  day: {
    minHeight: 132,
    borderRight: '1px solid #eadbd8',
    borderBottom: '1px solid #eadbd8',
    padding: 8,
    boxSizing: 'border-box',
    background: '#fff',
  },
  dayNumber: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    color: '#2b1b18',
    marginBottom: 6,
  },
  todayCircle: { background: '#7a2b26', color: '#fff', fontWeight: 700 },
  eventList: { display: 'flex', flexDirection: 'column', gap: 4 },
  event: {
    color: '#fff',
    borderRadius: 6,
    padding: '4px 7px',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}