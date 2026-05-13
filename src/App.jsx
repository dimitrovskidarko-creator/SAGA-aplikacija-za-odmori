import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://iynyzhiyddexvpxmodxi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bnl6aGl5ZGRleHZweG1vZHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTk3NjYsImV4cCI6MjA5Mjk5NTc2Nn0.V0_R1YPyCvKAqvE50J-oafL4lRXgnWOtsIPzwZcgyRU'
)

const VERSION = 'v1.18'
const APP_NAME = 'SAGA апликација за одмори'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  const [role, setRole] = useState('')
  const [fullName, setFullName] = useState('')

  const [loginEmail, setLoginEmail] = useState('')
  const [password, setPassword] = useState('')

  const [employees, setEmployees] = useState([])
  const [leaves, setLeaves] = useState([])
  const [myEmployee, setMyEmployee] = useState(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('Одмор')

  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)

      if (data.session) {
        loadAll(data.session.user)
      }

      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)

      if (newSession) {
        loadAll(newSession.user)
      }
    })

    return () => subscription.unsubscribe()
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
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('full_name')

    if (error) {
      alert(error.message)
      return
    }

    setEmployees(data || [])

    const me = (data || []).find((e) => e.email === userEmail)

    setMyEmployee(me || null)
  }

  async function loadLeaves() {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .order('start_date')

    if (error) {
      alert(error.message)
      return
    }

    setLeaves(data || [])
  }

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error) {
      alert(error.message)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  async function submitLeaveRequest() {
    if (!myEmployee?.id) {
      return alert('Нема employee запис')
    }

    if (!startDate || !endDate) {
      return alert('Избери датуми')
    }

    const { error } = await supabase.from('leave_requests').insert({
      employee_id: myEmployee.id,
      start_date: startDate,
      end_date: endDate,
      reason,
      status: 'pending',
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('Барањето е испратено ✅')

    setStartDate('')
    setEndDate('')
    setReason('Одмор')

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

    if (error) {
      alert(error.message)
      return
    }

    if (status === 'approved' && emp) {
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
    return new Date(dateString).toLocaleDateString('mk-MK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  function getCalendarDays() {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const startOffset =
      firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1

    const days = []

    for (let i = 0; i < startOffset; i++) {
      days.push(null)
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }

    while (days.length % 7 !== 0) {
      days.push(null)
    }

    return days
  }

  function getLeavesForDay(day) {
    if (!day) return []

    const d = formatDate(day)

    return leaves.filter(
      (l) =>
        l.status === 'approved' &&
        d >= l.start_date &&
        d <= l.end_date
    )
  }

  function getEmployeeById(id) {
    return employees.find((e) => e.id === id)
  }

  const myLeaves = useMemo(() => {
    if (!myEmployee?.id) return []

    return leaves.filter((l) => l.employee_id === myEmployee.id)
  }, [leaves, myEmployee])

  const pendingLeaves = leaves.filter(
    (l) => l.status === 'pending'
  )

  const monthName = currentDate.toLocaleDateString('mk-MK', {
    month: 'long',
    year: 'numeric',
  })

  const todayString = formatDate(new Date())

  if (loading) {
    return <div style={styles.center}>Loading...</div>
  }

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
          <div>
            <b>{fullName}</b>

            <div style={styles.roleBadge}>
              {role === 'hr' ? 'HR' : 'Вработен'}
            </div>
          </div>

          <button style={styles.logout} onClick={logout}>
            Одјави се
          </button>
        </div>
      </div>

      <div style={styles.container}>
        <div style={styles.calendarCard}>
          <div style={styles.calendarTop}>
            <h3>Календар - {monthName}</h3>

            <div>
              <button
                style={styles.smallButton}
                onClick={() =>
                  setCurrentDate(
                    new Date(
                      currentDate.getFullYear(),
                      currentDate.getMonth() - 1,
                      1
                    )
                  )
                }
              >
                ‹
              </button>

              <button
                style={styles.smallButton}
                onClick={() =>
                  setCurrentDate(
                    new Date(
                      currentDate.getFullYear(),
                      currentDate.getMonth() + 1,
                      1
                    )
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
              const isToday =
                day && formatDate(day) === todayString

              return (
                <div key={index} style={styles.day}>
                  {day && (
                    <>
                      <div
                        style={{
                          ...styles.dayNumber,
                          ...(isToday ? styles.today : {}),
                        }}
                      >
                        {day.getDate()}
                      </div>

                      {dayLeaves.map((leave) => {
                        const emp = getEmployeeById(
                          leave.employee_id
                        )

                        return (
                          <div
                            key={leave.id}
                            style={styles.event}
                          >
                            {emp?.full_name}
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
            <h2>Мој одмор</h2>

            <div style={styles.employeeInfo}>
              <div>
                Вкупно денови:
                <b>
                  {' '}
                  {Number(
                    myEmployee.leave_days_total || 0
                  )}
                </b>
              </div>

              <div>
                Искористени:
                <b>
                  {' '}
                  {Number(
                    myEmployee.leave_days_used || 0
                  )}
                </b>
              </div>

              <div>
                Останати:
                <b>
                  {' '}
                  {Number(
                    myEmployee.leave_days_total || 0
                  ) -
                    Number(
                      myEmployee.leave_days_used || 0
                    )}
                </b>
              </div>
            </div>
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

          <select
            style={styles.input}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="Одмор">Одмор</option>
            <option value="Боледување">
              Боледување
            </option>
          </select>

          <button
            style={styles.button}
            onClick={submitLeaveRequest}
          >
            Испрати барање
          </button>
        </div>

        <div style={styles.card}>
          <h3>Мои барања</h3>

          {myLeaves.map((leave) => (
            <div key={leave.id} style={styles.leave}>
              <div>
                <b>
                  {formatDisplayDate(
                    leave.start_date
                  )}{' '}
                  -{' '}
                  {formatDisplayDate(leave.end_date)}
                </b>

                <div>{leave.reason}</div>
              </div>

              <div>{leave.status}</div>
            </div>
          ))}
        </div>

        {role === 'hr' && (
          <div style={styles.card}>
            <h3>HR Одобрување</h3>

            {pendingLeaves.map((leave) => {
              const emp = employees.find(
                (e) => e.id === leave.employee_id
              )

              return (
                <div key={leave.id} style={styles.leave}>
                  <div>
                    <b>{emp?.full_name}</b>

                    <div>
                      {formatDisplayDate(
                        leave.start_date
                      )}{' '}
                      -{' '}
                      {formatDisplayDate(
                        leave.end_date
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      style={styles.approve}
                      onClick={() =>
                        updateLeaveStatus(
                          leave,
                          'approved'
                        )
                      }
                    >
                      Одобри
                    </button>

                    <button
                      style={styles.reject}
                      onClick={() =>
                        updateLeaveStatus(
                          leave,
                          'rejected'
                        )
                      }
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
  },

  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 15,
  },

  logo: {
    color: '#7a2b26',
    margin: 0,
  },

  roleBadge: {
    fontSize: 12,
    color: '#777',
  },

  container: {
    maxWidth: 1400,
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
  },

  event: {
    background: '#7a2b26',
    color: '#fff',
    padding: '4px 6px',
    borderRadius: 6,
    marginBottom: 4,
    fontSize: 11,
  },

  employeeInfo: {
    display: 'flex',
    gap: 25,
    fontSize: 18,
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
  },

  leave: {
    display: 'flex',
    justifyContent: 'space-between',
    border: '1px solid #ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
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