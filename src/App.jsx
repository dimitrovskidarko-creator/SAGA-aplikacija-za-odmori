import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://iynyzhiyddexvpxmodxi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Iml5bnl6aGl5ZGRleHZweG1vZHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTk3NjYsImV4cCI6MjA5Mjk5NTc2Nn0.V0_R1YPyCvKAqvE50J-oafL4lRXgnWOtsIPzwZcgyRU'
)

const VERSION = 'v1.13'

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

    console.log('EMAIL RESPONSE:', data)

    if (!res.ok) {
      console.error('EMAIL ERROR:', data)
      alert(data?.error || 'Email error')
    }
  } catch (err) {
    console.error('EMAIL CRASH:', err)
    alert('Email crash')
  }
}

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)

      if (data.session) {
        loadAll(data.session.user)
      }

      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)

        if (newSession) {
          loadAll(newSession.user)
        }
      }
    )

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
    const { data } = await supabase
      .from('employees')
      .select('*')
      .order('full_name')

    setEmployees(data || [])

    const found = (data || []).find((e) => e.email === userEmail)

    setMyEmployee(found || null)
  }

  async function loadLeaves() {
    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .order('start_date')

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

    const { error } = await supabase.from('leave_requests').insert({
      employee_id: myEmployee.id,
      start_date: startDate,
      end_date: endDate,
      reason,
      status: 'pending',
    })

    if (error) {
      return alert(error.message)
    }

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

  async function updateLeaveStatus(leave, status) {
    const emp = employees.find((e) => e.id === leave.employee_id)

    await supabase
      .from('leave_requests')
      .update({
        status,
        approved_by: fullName,
      })
      .eq('id', leave.id)

    await sendEmailNotification({
      type: 'request_status',
      employeeName: emp?.full_name,
      employeeEmail: emp?.email,
      startDate: leave.start_date,
      endDate: leave.end_date,
      reason: leave.reason,
      status,
    })

    await loadLeaves()
  }

  const myLeaves = useMemo(() => {
    if (!myEmployee?.id) return []

    return leaves.filter((l) => l.employee_id === myEmployee.id)
  }, [leaves, myEmployee])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!session) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1>SAGA апликација за одмори</h1>

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
        <h2>SAGA апликација за одмори</h2>

        <div>
          <b>{fullName}</b>

          <button style={styles.logout} onClick={logout}>
            Одјави се
          </button>
        </div>
      </div>

      <div style={styles.container}>
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
            <option value="Боледување">Боледување</option>
          </select>

          <button style={styles.button} onClick={submitLeaveRequest}>
            Испрати барање
          </button>
        </div>

        <div style={styles.card}>
          <h3>Мои барања</h3>

          {myLeaves.map((leave) => (
            <div key={leave.id} style={styles.leave}>
              <div>
                <b>
                  {leave.start_date} → {leave.end_date}
                </b>

                <div>{leave.reason}</div>
              </div>

              <div>{leave.status}</div>
            </div>
          ))}
        </div>

        {role === 'hr' && (
          <div style={styles.card}>
            <h3>HR Барања</h3>

            {leaves
              .filter((l) => l.status === 'pending')
              .map((leave) => {
                const emp = employees.find(
                  (e) => e.id === leave.employee_id
                )

                return (
                  <div key={leave.id} style={styles.leave}>
                    <div>
                      <b>{emp?.full_name}</b>

                      <div>
                        {leave.start_date} → {leave.end_date}
                      </div>

                      <div>{leave.reason}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        style={styles.approve}
                        onClick={() =>
                          updateLeaveStatus(leave, 'approved')
                        }
                      >
                        Одобри
                      </button>

                      <button
                        style={styles.reject}
                        onClick={() =>
                          updateLeaveStatus(leave, 'rejected')
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
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f1ef',
  },

  app: {
    minHeight: '100vh',
    background: '#f5f1ef',
    fontFamily: 'Arial',
  },

  navbar: {
    height: 70,
    background: '#fff',
    borderBottom: '1px solid #ddd',
    padding: '0 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  container: {
    padding: 25,
  },

  card: {
    background: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    border: '1px solid #ddd',
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
    padding: '12px 20px',
    background: '#7a2b26',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },

  logout: {
    marginLeft: 15,
    padding: '8px 12px',
    background: '#7a2b26',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },

  leave: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: 12,
    border: '1px solid #ddd',
    borderRadius: 10,
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

  version: {
    position: 'fixed',
    right: 15,
    bottom: 10,
    fontSize: 12,
    color: '#777',
  },
}