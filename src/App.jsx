import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://iynyzhiyddexvpxmodxi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bnl6aGl5ZGRleHZweG1vZHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTk3NjYsImV4cCI6MjA5Mjk5NTc2Nn0.V0_R1YPyCvKAqvE50J-oafL4lRXgnWOtsIPzwZcgyRU'
)

const VERSION = 'v1.15'

export default function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [profile, setProfile] = useState(null)
  const [employees, setEmployees] = useState([])
  const [leaves, setLeaves] = useState([])

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('Одмор')

  const [newPassword, setNewPassword] = useState('')

  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [newEmployeeEmail, setNewEmployeeEmail] = useState('')
  const [newEmployeeRole, setNewEmployeeRole] = useState('employee')
  const [newEmployeeDays, setNewEmployeeDays] = useState(20)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      loadData()
    }
  }, [session])

  async function loadData() {
    const userEmail = session.user.email

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', userEmail)
      .single()

    setProfile(profileData)

    const { data: employeesData } = await supabase
      .from('employees')
      .select('*')
      .order('full_name')

    setEmployees(employeesData || [])

    const { data: leaveData } = await supabase
      .from('leave_requests')
      .select('*')
      .order('start_date')

    setLeaves(leaveData || [])
  }

  async function login(e) {
    e.preventDefault()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  async function submitLeave() {
    const employee = employees.find((e) => e.email === session.user.email)

    if (!employee) return

    const { error } = await supabase.from('leave_requests').insert({
      employee_id: employee.id,
      employee_name: employee.full_name,
      start_date: startDate,
      end_date: endDate,
      reason,
      status: 'pending',
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('Барањето е испратено')

    setStartDate('')
    setEndDate('')
    setReason('Одмор')

    loadData()
  }

  async function updateLeaveStatus(leave, status) {
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status,
      })
      .eq('id', leave.id)

    if (error) {
      alert(error.message)
      return
    }

    if (status === 'approved') {
      const emp = employees.find((e) => e.id === leave.employee_id)

      if (emp) {
        const days = countDays(leave.start_date, leave.end_date)

        await supabase
          .from('employees')
          .update({
            leave_days_used:
              Number(emp.leave_days_used || 0) + Number(days),
          })
          .eq('id', emp.id)
      }
    }

    loadData()
  }

  async function addEmployee() {
    const { error } = await supabase.from('employees').insert({
      full_name: newEmployeeName,
      email: newEmployeeEmail,
      role: newEmployeeRole,
      leave_days_total: Number(newEmployeeDays),
      leave_days_used: 0,
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('Вработениот е додаден')

    setNewEmployeeName('')
    setNewEmployeeEmail('')
    setNewEmployeeRole('employee')
    setNewEmployeeDays(20)

    loadData()
  }

  async function deleteEmployee(id) {
    await supabase.from('employees').delete().eq('id', id)
    loadData()
  }

  async function updatePassword() {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      alert(error.message)
      return
    }

    alert('Лозинката е променета')
    setNewPassword('')
  }

  function countDays(start, end) {
    const s = new Date(start)
    const e = new Date(end)

    return (
      Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
    )
  }

  const role = profile?.role || 'employee'

  const myEmployee = employees.find(
    (e) => e.email === session?.user?.email
  )

  const approvedLeaves = useMemo(() => {
    return leaves.filter((l) => l.status === 'approved')
  }, [leaves])

  function renderCalendar() {
    const days = Array.from({ length: 31 }, (_, i) => i + 1)

    return (
      <div style={styles.calendarGrid}>
        {days.map((day) => {
          const dayLeaves = approvedLeaves.filter((leave) => {
            const start = new Date(leave.start_date).getDate()
            const end = new Date(leave.end_date).getDate()

            return day >= start && day <= end
          })

          return (
            <div key={day} style={styles.dayCell}>
              <div style={styles.dayNumber}>{day}</div>

              {dayLeaves.map((leave) => (
                <div
                  key={leave.id}
                  style={{
                    ...styles.leaveBadge,
                    background:
                      leave.reason === 'Нејавено отсуство'
                        ? '#7e22ce'
                        : leave.reason === 'Боледување'
                        ? '#1d4ed8'
                        : '#8b1e1e',
                  }}
                >
                  {leave.employee_name} - {leave.reason}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  if (!session) {
    return (
      <div style={styles.loginWrap}>
        <form style={styles.loginBox} onSubmit={login}>
          <h1 style={styles.logo}>SAGA апликација за одмори</h1>

          <input
            style={styles.input}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            style={styles.input}
            type="password"
            placeholder="Лозинка"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button style={styles.button}>Најави се</button>
        </form>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.logo}>SAGA апликација за одмори</h1>

        <div style={styles.userBox}>
          <div>{profile?.full_name}</div>
          <small>{role === 'hr' ? 'HR' : 'Вработен'}</small>
        </div>

        <button style={styles.logout} onClick={logout}>
          Одјави се
        </button>
      </div>

      <div style={styles.passwordMiniBox}>
        <input
          style={styles.smallInput}
          type="password"
          placeholder="Нова лозинка"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <button style={styles.smallButton} onClick={updatePassword}>
          Промени
        </button>
      </div>

      <div style={styles.card}>
        <h2>Календар</h2>
        {renderCalendar()}
      </div>

      {role !== 'hr' && (
        <div style={styles.card}>
          <h3>Мој одмор</h3>

          <div style={styles.statsRow}>
            <div style={styles.statBox}>
              <span>Вкупно</span>
              <b>{myEmployee?.leave_days_total || 0}</b>
            </div>

            <div style={styles.statBox}>
              <span>Искористено</span>
              <b>{myEmployee?.leave_days_used || 0}</b>
            </div>

            <div style={styles.statBox}>
              <span>Останато</span>
              <b>
                {(myEmployee?.leave_days_total || 0) -
                  (myEmployee?.leave_days_used || 0)}
              </b>
            </div>
          </div>
        </div>
      )}

      {role === 'hr' && (
        <>
          <div style={styles.card}>
            <h3>Додај вработен</h3>

            <input
              style={styles.input}
              placeholder="Име и презиме"
              value={newEmployeeName}
              onChange={(e) => setNewEmployeeName(e.target.value)}
            />

            <input
              style={styles.input}
              placeholder="Email"
              value={newEmployeeEmail}
              onChange={(e) => setNewEmployeeEmail(e.target.value)}
            />

            <select
              style={styles.input}
              value={newEmployeeRole}
              onChange={(e) => setNewEmployeeRole(e.target.value)}
            >
              <option value="employee">Вработен</option>
              <option value="hr">HR</option>
            </select>

            <input
              style={styles.input}
              type="number"
              placeholder="Денови одмор"
              value={newEmployeeDays}
              onChange={(e) => setNewEmployeeDays(e.target.value)}
            />

            <button style={styles.button} onClick={addEmployee}>
              Додади
            </button>
          </div>

          <div style={styles.card}>
            <h3>Вработени</h3>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Име</th>
                  <th>Email</th>
                  <th>Вкупно</th>
                  <th>Искористено</th>
                  <th>Останато</th>
                  <th>Акција</th>
                </tr>
              </thead>

              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td>{emp.full_name}</td>
                    <td>{emp.email}</td>
                    <td>{emp.leave_days_total}</td>
                    <td>{emp.leave_days_used}</td>
                    <td>
                      {Number(emp.leave_days_total) -
                        Number(emp.leave_days_used)}
                    </td>

                    <td>
                      <button
                        style={styles.deleteBtn}
                        onClick={() => deleteEmployee(emp.id)}
                      >
                        Избриши
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {role !== 'hr' && (
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
            <option>Одмор</option>
            <option>Боледување</option>
          </select>

          <button style={styles.button} onClick={submitLeave}>
            Испрати барање
          </button>
        </div>
      )}

      {role === 'hr' && (
        <div style={styles.card}>
          <h3>Барања</h3>

          {leaves
            .filter((l) => l.status === 'pending')
            .map((leave) => (
              <div key={leave.id} style={styles.leaveCard}>
                <div>
                  <b>{leave.employee_name}</b>

                  <div>
                    {leave.start_date} до {leave.end_date}
                  </div>

                  <small>{leave.reason}</small>
                </div>

                <div style={styles.actionRow}>
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
            ))}
        </div>
      )}

      <div style={styles.version}>{VERSION}</div>
    </div>
  )
}

const styles = {
  page: {
    background: '#f6f2f1',
    minHeight: '100vh',
    paddingBottom: 40,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottom: '1px solid #ddd',
    background: '#fff',
  },

  logo: {
    color: '#7f1d1d',
    margin: 0,
    fontWeight: 800,
  },

  loginWrap: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#f6f2f1',
  },

  loginBox: {
    width: 350,
    background: '#fff',
    padding: 30,
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },

  card: {
    background: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 16,
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  },

  input: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    border: '1px solid #ddd',
    marginBottom: 12,
  },

  button: {
    background: '#7f1d1d',
    color: '#fff',
    border: 'none',
    padding: '12px 18px',
    borderRadius: 10,
    cursor: 'pointer',
  },

  logout: {
    background: '#fff',
    color: '#7f1d1d',
    border: '1px solid #7f1d1d',
    padding: '10px 16px',
    borderRadius: 10,
    cursor: 'pointer',
  },

  userBox: {
    marginLeft: 'auto',
    marginRight: 20,
    textAlign: 'right',
  },

  passwordMiniBox: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '10px 20px 0',
  },

  smallInput: {
    width: 220,
    padding: 10,
    borderRadius: 10,
    border: '1px solid #ddd',
  },

  smallButton: {
    background: '#7f1d1d',
    color: '#fff',
    border: 'none',
    padding: '10px 14px',
    borderRadius: 10,
    cursor: 'pointer',
  },

  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 1,
    background: '#ddd',
  },

  dayCell: {
    minHeight: 120,
    background: '#fff',
    padding: 8,
  },

  dayNumber: {
    fontWeight: 700,
    marginBottom: 8,
  },

  leaveBadge: {
    color: '#fff',
    padding: '6px 8px',
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 4,
    fontWeight: 600,
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },

  leaveCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid #eee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },

  actionRow: {
    display: 'flex',
    gap: 10,
  },

  approve: {
    background: 'green',
    color: '#fff',
    border: 'none',
    padding: '10px 14px',
    borderRadius: 10,
    cursor: 'pointer',
  },

  reject: {
    background: 'crimson',
    color: '#fff',
    border: 'none',
    padding: '10px 14px',
    borderRadius: 10,
    cursor: 'pointer',
  },

  deleteBtn: {
    background: '#7f1d1d',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
  },

  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },

  statBox: {
    background: '#f8f3f1',
    border: '1px solid #eadbd8',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  version: {
    position: 'fixed',
    right: 10,
    bottom: 10,
    color: '#777',
    fontSize: 12,
  },
}