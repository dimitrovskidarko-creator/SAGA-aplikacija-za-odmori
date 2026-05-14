import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://iynyzhiyddexvpxmodxi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Iml5bnl6aGl5ZGRleHZweG1vZHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTk3NjYsImV4cCI6MjA5Mjk5NTc2Nn0.V0_R1YPyCvKAqvE50J-oafL4lRXgnWOtsIPzwZcgyRU'
)

const VERSION = 'v1.21'
const APP_NAME = 'SAGA апликација за одмори'
const EMAIL_FUNCTION_URL =
  'https://iynyzhiyddexvpxmodxi.supabase.co/functions/v1/send-email-notification'

async function sendEmailNotification(payload) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch(EMAIL_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.error('EMAIL ERROR:', data)
      alert('Запишано е, но email не се испрати. Провери Edge Function logs.')
    }
  } catch (err) {
    console.error('EMAIL CRASH:', err)
    alert('Запишано е, но email функцијата падна. Провери Console.')
  }
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  const [role, setRole] = useState('')
  const [fullName, setFullName] = useState('')

  const [loginEmail, setLoginEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const [employees, setEmployees] = useState([])
  const [leaves, setLeaves] = useState([])
  const [myEmployee, setMyEmployee] = useState(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('Одмор')

  const [absenceEmployeeId, setAbsenceEmployeeId] = useState('')
  const [absenceStartDate, setAbsenceStartDate] = useState('')
  const [absenceEndDate, setAbsenceEndDate] = useState('')

  const [currentDate, setCurrentDate] = useState(new Date())

  const [editingEmployeeId, setEditingEmployeeId] = useState('')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editTotalDays, setEditTotalDays] = useState(20)
  const [editUsedDays, setEditUsedDays] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadAll(data.session.user)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) loadAll(newSession.user)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function loadAll(user) {
    await loadProfile(user)
    await loadEmployees(user.email)
    await loadLeaves()
  }

  async function loadProfile(user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    setRole(data?.role || 'employee')
    setFullName(data?.full_name || user.email)
  }

  async function loadEmployees(userEmail) {
    const { data, error } = await supabase.from('employees').select('*').order('full_name')

    if (error) return alert(error.message)

    setEmployees(data || [])
    setMyEmployee((data || []).find((e) => e.email === userEmail) || null)
  }

  async function loadLeaves() {
    const { data, error } = await supabase.from('leave_requests').select('*').order('start_date')

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

  async function changePassword() {
    if (!newPassword || newPassword.length < 6) {
      return alert('Лозинката мора да има минимум 6 карактери')
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) return alert(error.message)

    alert('Лозинката е успешно променета ✅')
    setNewPassword('')
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.reload()
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
    })

    if (error) return alert(error.message)

    await sendEmailNotification({
      type: 'new_request',
      employeeName: myEmployee.full_name,
      employeeEmail: myEmployee.email,
      startDate,
      endDate,
      reason,
    })

    alert('Барањето е испратено ✅')

    setStartDate('')
    setEndDate('')
    setReason('Одмор')

    await loadLeaves()
  }

  async function addUnexcusedAbsence() {
    if (role !== 'hr') return alert('Само HR може да внесува нејавено отсуство')
    if (!absenceEmployeeId) return alert('Избери вработен')
    if (!absenceStartDate || !absenceEndDate) return alert('Избери датуми')
    if (absenceEndDate < absenceStartDate) {
      return alert('Крајниот датум не може да биде пред почетниот')
    }

    const emp = employees.find((e) => e.id === absenceEmployeeId)

    if (!emp) return alert('Не е пронајден вработен')

    const { error } = await supabase.from('leave_requests').insert({
      employee_id: absenceEmployeeId,
      start_date: absenceStartDate,
      end_date: absenceEndDate,
      reason: 'Нејавено отсуство',
      status: 'approved',
      approved_by: fullName,
    })

    if (error) return alert(error.message)

    const days = countDays(absenceStartDate, absenceEndDate)

    const { error: updateError } = await supabase
      .from('employees')
      .update({
        leave_days_used: Number(emp.leave_days_used || 0) + days,
      })
      .eq('id', emp.id)

    if (updateError) return alert(updateError.message)

    await sendEmailNotification({
      type: 'unexcused_absence',
      employeeName: emp.full_name,
      employeeEmail: emp.email,
      startDate: absenceStartDate,
      endDate: absenceEndDate,
      reason: 'Нејавено отсуство',
      days,
    })

    alert('Нејавеното отсуство е внесено ✅')

    setAbsenceEmployeeId('')
    setAbsenceStartDate('')
    setAbsenceEndDate('')

    await loadEmployees(session.user.email)
    await loadLeaves()
  }

  async function updateLeaveStatus(leave, status) {
    const emp = employees.find((e) => e.id === leave.employee_id)

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status,
        approved_by: fullName,
      })
      .eq('id', leave.id)

    if (error) return alert(error.message)

    if (status === 'approved' && emp && leave.reason !== 'Боледување') {
      const days = countDays(leave.start_date, leave.end_date)

      await supabase
        .from('employees')
        .update({
          leave_days_used: Number(emp.leave_days_used || 0) + days,
        })
        .eq('id', emp.id)
    }

    await sendEmailNotification({
      type: 'request_status',
      employeeName: emp?.full_name,
      employeeEmail: emp?.email,
      startDate: leave.start_date,
      endDate: leave.end_date,
      reason: leave.reason,
      status,
    })

    await loadEmployees(session.user.email)
    await loadLeaves()
  }

  function startEditEmployee(emp) {
    setEditingEmployeeId(emp.id)
    setEditName(emp.full_name || '')
    setEditEmail(emp.email || '')
    setEditTotalDays(Number(emp.leave_days_total || 0))
    setEditUsedDays(Number(emp.leave_days_used || 0))
  }

  function cancelEditEmployee() {
    setEditingEmployeeId('')
    setEditName('')
    setEditEmail('')
    setEditTotalDays(20)
    setEditUsedDays(0)
  }

  async function saveEmployeeEdit() {
    if (role !== 'hr') return alert('Само HR може да менува')
    if (!editingEmployeeId) return
    if (!editName || !editEmail) return alert('Внеси име и email')

    const { error } = await supabase
      .from('employees')
      .update({
        full_name: editName,
        email: editEmail,
        leave_days_total: Number(editTotalDays || 0),
        leave_days_used: Number(editUsedDays || 0),
      })
      .eq('id', editingEmployeeId)

    if (error) return alert(error.message)

    alert('Вработениот е изменет ✅')

    cancelEditEmployee()
    await loadEmployees(session.user.email)
  }

  function countDays(start, end) {
    const s = new Date(start)
    const e = new Date(end)

    return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1
  }

  function formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')

    return `${y}-${m}-${d}`
  }

  function formatDisplayDate(dateString) {
    if (!dateString) return ''
    const [year, month, day] = dateString.split('-')
    return `${day}.${month}.${year}`
  }

  function translateStatus(status) {
    if (status === 'approved') return 'Одобрено'
    if (status === 'rejected') return 'Одбиено'
    if (status === 'pending') return 'Се чека'
    return status
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

    return leaves.filter(
      (l) => l.status === 'approved' && d >= l.start_date && d <= l.end_date
    )
  }

  function getEmployeeById(id) {
    return employees.find((e) => e.id === id)
  }

  function getEventColor(leave, index) {
    if (leave.reason === 'Боледување') return '#2563eb'
    if (leave.reason === 'Нејавено отсуство') return '#7c3aed'

    const colors = [
      '#7a2b26',
      '#188038',
      '#b45309',
      '#0f766e',
      '#be123c',
      '#9333ea',
      '#ea580c',
      '#0284c7',
      '#4f46e5',
      '#15803d',
      '#c026d3',
      '#0d9488',
    ]

    const empIndex = employees.findIndex((e) => e.id === leave.employee_id)

    return colors[(empIndex >= 0 ? empIndex : index) % colors.length]
  }

  const myLeaves = useMemo(() => {
    if (!myEmployee?.id) return []
    return leaves.filter((l) => l.employee_id === myEmployee.id)
  }, [leaves, myEmployee])

  const pendingLeaves = leaves.filter((l) => l.status === 'pending')

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
          <h1 style={styles.logo}>{APP_NAME}</h1>

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
            onKeyDown={(e) => {
              if (e.key === 'Enter') login()
            }}
          />

          <button style={styles.button} onClick={login}>
            Најави се
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.app}>
      <div style={styles.navbar}>
        <h2 style={styles.logo}>{APP_NAME}</h2>

        <div style={styles.navRight}>
          <div style={{ textAlign: 'right' }}>
            <b>{fullName}</b>
            <div style={styles.roleBadge}>{role === 'hr' ? 'HR' : 'Вработен'}</div>
          </div>

          <div style={styles.passwordMini}>
            <input
              style={styles.passwordInput}
              type="password"
              placeholder="Нова лозинка"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <button style={styles.passwordButton} onClick={changePassword}>
              Промени
            </button>
          </div>

          <button style={styles.logout} onClick={logout}>
            Одјави се
          </button>
        </div>
      </div>

      <div style={styles.container}>
        <div style={styles.calendarCard}>
          <div style={styles.calendarTop}>
            <div style={styles.calendarTitleWrap}>
              <h3 style={styles.calendarTitle}>Календар</h3>
              <span style={styles.monthName}>{monthName}</span>
            </div>

            <div>
              <button style={styles.smallButton} onClick={() => setCurrentDate(new Date())}>
                Денес
              </button>

              <button
                style={styles.smallButton}
                onClick={() =>
                  setCurrentDate(
                    new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
                  )
                }
              >
                ‹
              </button>

              <button
                style={styles.smallButton}
                onClick={() =>
                  setCurrentDate(
                    new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
                  )
                }
              >
                ›
              </button>
            </div>
          </div>

          <div style={styles.weekHeader}>
            <div>Пон</div>
            <div>Вто</div>
            <div>Сре</div>
            <div>Чет</div>
            <div>Пет</div>
            <div>Саб</div>
            <div>Нед</div>
          </div>

          <div style={styles.calendarGrid}>
            {getCalendarDays().map((day, index) => {
              const dayLeaves = getLeavesForDay(day)
              const isToday = day && formatDate(day) === todayString

              return (
                <div key={index} style={styles.day}>
                  {day && (
                    <>
                      <div style={{ ...styles.dayNumber, ...(isToday ? styles.today : {}) }}>
                        {day.getDate()}
                      </div>

                      {dayLeaves.map((leave, i) => {
                        const emp = getEmployeeById(leave.employee_id)

                        return (
                          <div
                            key={leave.id}
                            style={{
                              ...styles.event,
                              background: getEventColor(leave, i),
                            }}
                            title={`${emp?.full_name || 'Вработен'} - ${leave.reason || 'Одмор'}`}
                          >
                            {emp?.full_name || 'Вработен'}
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {myEmployee && (
          <div style={styles.card}>
            <h3>Мој одмор</h3>

            <div style={styles.employeeInfo}>
              <div>
                Вкупно: <b>{Number(myEmployee.leave_days_total || 0)}</b>
              </div>

              <div>
                Искористено: <b>{Number(myEmployee.leave_days_used || 0)}</b>
              </div>

              <div>
                Останато:{' '}
                <b>
                  {Number(myEmployee.leave_days_total || 0) -
                    Number(myEmployee.leave_days_used || 0)}
                </b>
              </div>
            </div>
          </div>
        )}

        {role === 'hr' && (
          <div style={styles.card}>
            <h3>Нејавено отсуство</h3>

            <select
              style={styles.input}
              value={absenceEmployeeId}
              onChange={(e) => setAbsenceEmployeeId(e.target.value)}
            >
              <option value="">Избери вработен</option>

              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>

            <input
              style={styles.input}
              type="date"
              value={absenceStartDate}
              onChange={(e) => setAbsenceStartDate(e.target.value)}
            />

            <input
              style={styles.input}
              type="date"
              value={absenceEndDate}
              onChange={(e) => setAbsenceEndDate(e.target.value)}
            />

            <button style={styles.reject} onClick={addUnexcusedAbsence}>
              Внеси отсуство
            </button>
          </div>
        )}

        {role === 'hr' && (
          <div style={styles.card}>
            <h3>HR уредување на вработени</h3>

            {employees.map((emp) => {
              const total = Number(emp.leave_days_total || 0)
              const used = Number(emp.leave_days_used || 0)
              const remaining = total - used
              const isEditing = editingEmployeeId === emp.id

              return (
                <div key={emp.id} style={styles.employeeBox}>
                  {!isEditing ? (
                    <>
                      <div>
                        <b>{emp.full_name}</b>
                        <div style={styles.muted}>{emp.email}</div>
                        <div>
                          Вкупно: <b>{total}</b> | Искористено: <b>{used}</b> | Останато:{' '}
                          <b>{remaining}</b>
                        </div>
                      </div>

                      <button style={styles.smallButton} onClick={() => startEditEmployee(emp)}>
                        Измени
                      </button>
                    </>
                  ) : (
                    <div style={{ width: '100%' }}>
                      <input
                        style={styles.input}
                        placeholder="Име и презиме"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />

                      <input
                        style={styles.input}
                        placeholder="Email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                      />

                      <input
                        style={styles.input}
                        type="number"
                        placeholder="Вкупно денови одмор"
                        value={editTotalDays}
                        onChange={(e) => setEditTotalDays(e.target.value)}
                      />

                      <input
                        style={styles.input}
                        type="number"
                        placeholder="Искористени денови"
                        value={editUsedDays}
                        onChange={(e) => setEditUsedDays(e.target.value)}
                      />

                      <div style={{ display: 'flex', gap: 10 }}>
                        <button style={styles.approve} onClick={saveEmployeeEdit}>
                          Зачувај
                        </button>

                        <button style={styles.reject} onClick={cancelEditEmployee}>
                          Откажи
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={styles.card}>
          <h3>Поднеси барање</h3>

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

          <select style={styles.input} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="Одмор">Одмор</option>
            <option value="Боледување">Боледување</option>
          </select>

          <button style={styles.button} onClick={submitLeaveRequest}>
            Испрати барање
          </button>
        </div>

        <div style={styles.card}>
          <h3>Мои барања</h3>

          {myLeaves.length === 0 && <p>Нема барања.</p>}

          {myLeaves.map((leave) => (
            <div key={leave.id} style={styles.leave}>
              <div>
                <b>
                  {formatDisplayDate(leave.start_date)} - {formatDisplayDate(leave.end_date)}
                </b>
                <div>{leave.reason}</div>
              </div>

              <div>{translateStatus(leave.status)}</div>
            </div>
          ))}
        </div>

        {role === 'hr' && (
          <div style={styles.card}>
            <h3>HR Одобрување</h3>

            {pendingLeaves.length === 0 && <p>Нема нови барања.</p>}

            {pendingLeaves.map((leave) => {
              const emp = employees.find((e) => e.id === leave.employee_id)

              return (
                <div key={leave.id} style={styles.leave}>
                  <div>
                    <b>{emp?.full_name}</b>
                    <div>
                      {formatDisplayDate(leave.start_date)} - {formatDisplayDate(leave.end_date)}
                    </div>
                    <div>{leave.reason}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      style={styles.approve}
                      onClick={() => updateLeaveStatus(leave, 'approved')}
                    >
                      Одобри
                    </button>

                    <button
                      style={styles.reject}
                      onClick={() => updateLeaveStatus(leave, 'rejected')}
                    >
                      Одбиј
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={styles.version}>{VERSION}</div>
      </div>
    </div>
  )
}

const styles = {
  center: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#f5f1ef',
  },

  app: {
    minHeight: '100vh',
    background: '#f5f1ef',
    fontFamily: 'Arial',
  },

  navbar: {
    background: '#fff',
    borderBottom: '1px solid #ddd',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
  },

  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 15,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },

  logo: {
    color: '#7a2b26',
    margin: 0,
  },

  roleBadge: {
    fontSize: 12,
    color: '#777',
  },

  passwordMini: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#fff',
    border: '1px solid #eadbd8',
    borderRadius: 10,
    padding: '8px 10px',
  },

  passwordInput: {
    width: 210,
    padding: '9px 10px',
    border: '1px solid #ddd',
    borderRadius: 8,
    outline: 'none',
  },

  passwordButton: {
    padding: '9px 13px',
    borderRadius: 8,
    border: 'none',
    background: '#7a2b26',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },

  container: {
    maxWidth: 1450,
    margin: '0 auto',
    padding: 20,
  },

  card: {
    background: '#fff',
    padding: 20,
    borderRadius: 14,
    border: '1px solid #ddd',
    marginBottom: 20,
  },

  calendarCard: {
    background: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid #ddd',
    marginBottom: 20,
  },

  calendarTop: {
    padding: 20,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #ddd',
  },

  calendarTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
  },

  calendarTitle: {
    margin: 0,
    fontSize: 24,
  },

  monthName: {
    color: '#80645f',
    textTransform: 'capitalize',
    fontSize: 18,
  },

  weekHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7,1fr)',
    textAlign: 'center',
    fontWeight: 'bold',
    padding: '10px 0',
    borderBottom: '1px solid #ddd',
  },

  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7,1fr)',
  },

  day: {
    minHeight: 120,
    borderRight: '1px solid #eee',
    borderBottom: '1px solid #eee',
    padding: 8,
  },

  dayNumber: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },

  today: {
    background: '#7a2b26',
    color: '#fff',
    fontWeight: 700,
  },

  event: {
    color: '#fff',
    padding: '4px 6px',
    borderRadius: 6,
    marginBottom: 4,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  employeeInfo: {
    display: 'flex',
    gap: 25,
    fontSize: 18,
    flexWrap: 'wrap',
  },

  input: {
    width: '100%',
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    border: '1px solid #ccc',
    boxSizing: 'border-box',
  },

  button: {
    background: '#7a2b26',
    color: '#fff',
    border: 'none',
    padding: '12px 20px',
    borderRadius: 8,
    cursor: 'pointer',
  },

  logout: {
    background: '#fff',
    border: '1px solid #7a2b26',
    color: '#7a2b26',
    padding: '10px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 700,
  },

  leave: {
    display: 'flex',
    justifyContent: 'space-between',
    border: '1px solid #ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },

  approve: {
    background: 'green',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
  },

  reject: {
    background: 'crimson',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
  },

  smallButton: {
    marginLeft: 8,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #7a2b26',
    background: '#fff',
    color: '#7a2b26',
    cursor: 'pointer',
    fontWeight: 'bold',
  },

  employeeBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    border: '1px solid #ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },

  muted: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
  },

  loginCard: {
    width: 380,
    background: '#fff',
    padding: 30,
    borderRadius: 14,
    border: '1px solid #ddd',
  },

  version: {
    position: 'fixed',
    right: 15,
    bottom: 10,
    fontSize: 12,
    color: '#777',
  },
}