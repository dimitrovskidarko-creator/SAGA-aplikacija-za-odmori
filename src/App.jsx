import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const supabase = createClient(
  'https://iynyzhiyddexvpxmodxi.supabase.co',
  '  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bnl6aGl5ZGRleHZweG1vZHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTk3NjYsImV4cCI6MjA5Mjk5NTc2Nn0.V0_R1YPyCvKAqvE50J-oafL4lRXgnWOtsIPzwZcgyRU'
)

const VERSION = 'v1.26'
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
  const reportRef = useRef(null)

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activePage, setActivePage] = useState('overview')
  const [darkMode, setDarkMode] = useState(false)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)

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

  const isMobile = windowWidth < 800

  const theme = {
    bg: darkMode ? '#071923' : '#f4fbfb',
    card: darkMode ? '#0f2530' : '#fff',
    text: darkMode ? '#e8fbfb' : '#111827',
    muted: darkMode ? '#9cc8c8' : '#667085',
    border: darkMode ? '#1e4450' : '#d8eeee',
    line: darkMode ? '#1e4450' : '#edf5f5',
  }

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
    if (absenceEndDate < absenceStartDate) return alert('Крајниот датум не може да биде пред почетниот')

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

  async function exportReportsPdf() {
    try {
      if (!reportRef.current) return

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth - 20
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 10

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`SAGA-izvestai-${formatDate(new Date())}.pdf`)
    } catch (err) {
      console.error(err)
      alert('PDF export не успеа.')
    }
  }

  function countDays(start, end) {
    const startDate = new Date(start)
    const endDate = new Date(end)

    let count = 0
    const current = new Date(startDate)

    while (current <= endDate) {
      const day = current.getDay()
      if (day !== 0 && day !== 6) count++
      current.setDate(current.getDate() + 1)
    }

    return count
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
      '#dc2626',
      '#16a34a',
      '#2563eb',
      '#f59e0b',
      '#9333ea',
      '#0f766e',
      '#e11d48',
      '#0891b2',
      '#ea580c',
      '#4f46e5',
      '#65a30d',
      '#be123c',
      '#0284c7',
      '#ca8a04',
      '#7c2d12',
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

  const approvedCount = leaves.filter((l) => l.status === 'approved').length
  const pendingCount = leaves.filter((l) => l.status === 'pending').length
  const rejectedCount = leaves.filter((l) => l.status === 'rejected').length
  const vacationCount = leaves.filter((l) => l.reason === 'Одмор').length
  const sickCount = leaves.filter((l) => l.reason === 'Боледување').length
  const unexcusedCount = leaves.filter((l) => l.reason === 'Нејавено отсуство').length

  const totalRequests = leaves.length || 1
  const approvedPercent = Math.round((approvedCount / totalRequests) * 100)
  const pendingPercent = Math.round((pendingCount / totalRequests) * 100)
  const rejectedPercent = Math.round((rejectedCount / totalRequests) * 100)

  const totalUsedDays = employees.reduce(
    (sum, emp) => sum + Number(emp.leave_days_used || 0),
    0
  )

  const totalRemainingDays = employees.reduce(
    (sum, emp) =>
      sum +
      (Number(emp.leave_days_total || 0) - Number(emp.leave_days_used || 0)),
    0
  )

  const topEmployee = [...employees].sort(
    (a, b) => Number(b.leave_days_used || 0) - Number(a.leave_days_used || 0)
  )[0]

  const months = [
    'Јануари',
    'Февруари',
    'Март',
    'Април',
    'Мај',
    'Јуни',
    'Јули',
    'Август',
    'Септември',
    'Октомври',
    'Ноември',
    'Декември',
  ]

  const monthName = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  const todayString = formatDate(new Date())

  if (loading) return <div style={styles.center}>Loading...</div>

  if (!session) {
    return (
      <div style={{ ...styles.center, background: theme.bg }}>
        <div style={{ ...styles.loginCard, background: theme.card, borderColor: theme.border }}>
          <h1 style={styles.loginLogo}>SAGA</h1>
          <p style={{ ...styles.loginSubtitle, color: theme.muted }}>Апликација за одмори</p>

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

  const showOverview = activePage === 'overview'
  const showCalendar = showOverview || activePage === 'calendar'
  const showRequests = showOverview || activePage === 'requests'
  const showAbsences = showOverview || activePage === 'absences'
  const showEmployees = role === 'hr' && activePage === 'employees'
  const showReports = role === 'hr' && activePage === 'reports'

  return (
    <div
      style={{
        ...styles.shell,
        background: theme.bg,
        color: theme.text,
        flexDirection: isMobile ? 'column' : 'row',
      }}
    >
      <aside
        style={{
          ...styles.sidebar,
          width: isMobile ? '100%' : 270,
          minHeight: isMobile ? 'auto' : '100vh',
          position: isMobile ? 'relative' : 'sticky',
        }}
      >
        <div style={styles.brand}>
          <div style={styles.brandIcon}>S</div>
          <div>
            <div style={styles.brandTitle}>SAGA</div>
            <div style={styles.brandSub}>HR APP</div>
          </div>
        </div>

        <div
          style={{
            ...styles.menu,
            flexDirection: isMobile ? 'row' : 'column',
            flexWrap: isMobile ? 'wrap' : 'nowrap',
          }}
        >
          <MenuItem active={activePage === 'overview'} onClick={() => setActivePage('overview')}>
            ▣ Преглед
          </MenuItem>

          <MenuItem active={activePage === 'calendar'} onClick={() => setActivePage('calendar')}>
            ▦ Календар
          </MenuItem>

          <MenuItem active={activePage === 'requests'} onClick={() => setActivePage('requests')}>
            ☑ Барања за одмор
          </MenuItem>

          {role === 'hr' && (
            <MenuItem active={activePage === 'absences'} onClick={() => setActivePage('absences')}>
              ◷ Нејавено отсуство
            </MenuItem>
          )}

          {role === 'hr' && (
            <MenuItem active={activePage === 'employees'} onClick={() => setActivePage('employees')}>
              ◎ Вработени
            </MenuItem>
          )}

          {role === 'hr' && (
            <MenuItem active={activePage === 'reports'} onClick={() => setActivePage('reports')}>
              ▤ Извештаи
            </MenuItem>
          )}
        </div>

        {!isMobile && (
          <div style={styles.sidebarUser}>
            <div style={styles.avatar}>
              {(fullName || 'U')
                .split(' ')
                .map((x) => x[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div>
              <b>{fullName}</b>
              <div style={styles.sidebarRole}>
                {role === 'hr' ? 'HR Администратор' : 'Вработен'}
              </div>
            </div>
          </div>
        )}
      </aside>

      <main
        style={{
          ...styles.main,
          padding: isMobile ? 14 : 26,
        }}
      >
        <div
          style={{
            ...styles.topbar,
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
          }}
        >
          <div>
            <h1 style={styles.pageTitle}>
              {activePage === 'overview' && 'Преглед'}
              {activePage === 'calendar' && 'Календар'}
              {activePage === 'requests' && 'Барања за одмор'}
              {activePage === 'absences' && 'Нејавено отсуство'}
              {activePage === 'employees' && 'Вработени'}
              {activePage === 'reports' && 'Извештаи'}
            </h1>
            <div style={{ ...styles.pageSubtitle, color: theme.muted }}>
              Добредојде, {fullName}
            </div>
          </div>

          <div
            style={{
              ...styles.navRight,
              justifyContent: isMobile ? 'flex-start' : 'flex-end',
            }}
          >
            <button style={styles.themeButton} onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? 'Light' : 'Dark'}
            </button>

            <div style={{ ...styles.passwordMini, background: theme.card, borderColor: theme.border }}>
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

        {role === 'hr' && showOverview && (
          <>
            <div style={{ ...styles.kpiGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)' }}>
              <Kpi icon="📄" value={leaves.length} label="Вкупно барања" styleIcon={styles.kpiIcon} theme={theme} />
              <Kpi icon="✓" value={`${approvedPercent}%`} label={`Одобрени (${approvedCount})`} styleIcon={styles.kpiIconGreen} theme={theme} />
              <Kpi icon="⏱" value={`${pendingPercent}%`} label={`На чекање (${pendingCount})`} styleIcon={styles.kpiIconYellow} theme={theme} />
              <Kpi icon="×" value={`${rejectedPercent}%`} label={`Одбиени (${rejectedCount})`} styleIcon={styles.kpiIconRed} theme={theme} />
            </div>

            <div
              style={{
                ...styles.reportGrid,
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              }}
            >
              <div style={{ ...styles.reportBox, background: theme.card, borderColor: theme.border }}>
                <h3>Искористен одмор</h3>
                <h2>{totalUsedDays} дена</h2>
                <p style={{ color: theme.muted }}>Вкупно искористени денови</p>
              </div>

              <div style={{ ...styles.reportBox, background: theme.card, borderColor: theme.border }}>
                <h3>Останат одмор</h3>
                <h2>{totalRemainingDays} дена</h2>
                <p style={{ color: theme.muted }}>Вкупно останати денови</p>
              </div>

              <div style={{ ...styles.reportBox, background: theme.card, borderColor: theme.border }}>
                <h3>Најмногу искористил</h3>
                <h2>{topEmployee?.full_name || '-'}</h2>
                <p style={{ color: theme.muted }}>
                  {Number(topEmployee?.leave_days_used || 0)} дена
                </p>
              </div>
            </div>
          </>
        )}

        {showCalendar && (
          <div style={{ ...styles.calendarCard, background: theme.card, borderColor: theme.border }}>
            <div style={{ ...styles.calendarTop, borderColor: theme.line }}>
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

            <div style={{ ...styles.weekHeader, borderColor: theme.line, color: theme.muted }}>
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
                  <div
                    key={index}
                    style={{
                      ...styles.day,
                      background: theme.card,
                      borderColor: theme.line,
                    }}
                  >
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
        )}

        {myEmployee && (showOverview || activePage === 'requests') && (
          <Card theme={theme}>
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
          </Card>
        )}

        {role === 'hr' && showAbsences && (
          <Card theme={theme}>
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
          </Card>
        )}

        {showEmployees && (
          <Card theme={theme}>
            <h3>HR уредување на вработени</h3>

            {employees.map((emp) => {
              const total = Number(emp.leave_days_total || 0)
              const used = Number(emp.leave_days_used || 0)
              const remaining = total - used
              const isEditing = editingEmployeeId === emp.id

              return (
                <div key={emp.id} style={{ ...styles.employeeBox, borderColor: theme.border }}>
                  {!isEditing ? (
                    <>
                      <div>
                        <b>{emp.full_name}</b>
                        <div style={{ ...styles.muted, color: theme.muted }}>{emp.email}</div>
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
          </Card>
        )}

        {showRequests && (
          <>
            <Card theme={theme}>
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
            </Card>

            <Card theme={theme}>
              <h3>Мои барања</h3>

              {myLeaves.length === 0 && <p>Нема барања.</p>}

              {myLeaves.map((leave) => (
                <div key={leave.id} style={{ ...styles.leave, borderColor: theme.border }}>
                  <div>
                    <b>
                      {formatDisplayDate(leave.start_date)} - {formatDisplayDate(leave.end_date)}
                    </b>
                    <div>{leave.reason}</div>
                  </div>

                  <div>{translateStatus(leave.status)}</div>
                </div>
              ))}
            </Card>

            {role === 'hr' && (
              <Card theme={theme}>
                <h3>HR Одобрување</h3>

                {pendingLeaves.length === 0 && <p>Нема нови барања.</p>}

                {pendingLeaves.map((leave) => {
                  const emp = employees.find((e) => e.id === leave.employee_id)

                  return (
                    <div key={leave.id} style={{ ...styles.leave, borderColor: theme.border }}>
                      <div>
                        <b>{emp?.full_name}</b>
                        <div>
                          {formatDisplayDate(leave.start_date)} -{' '}
                          {formatDisplayDate(leave.end_date)}
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
              </Card>
            )}
          </>
        )}

        {showReports && (
          <div
            ref={reportRef}
            style={{
              ...styles.card,
              background: theme.card,
              borderColor: theme.border,
            }}
          >
            <div style={styles.reportHeader}>
              <div>
                <h3>Извештаи</h3>
                <p style={{ ...styles.muted, color: theme.muted }}>
                  Преглед на барања, отсуства и искористени денови.
                </p>
              </div>

              <button style={styles.button} onClick={exportReportsPdf}>
                Export PDF
              </button>
            </div>

            <div style={{ ...styles.kpiGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)' }}>
              <Kpi icon="📄" value={leaves.length} label="Вкупно барања" styleIcon={styles.kpiIcon} theme={theme} />
              <Kpi icon="✓" value={approvedCount} label="Одобрени" styleIcon={styles.kpiIconGreen} theme={theme} />
              <Kpi icon="⏱" value={pendingCount} label="На чекање" styleIcon={styles.kpiIconYellow} theme={theme} />
              <Kpi icon="×" value={rejectedCount} label="Одбиени" styleIcon={styles.kpiIconRed} theme={theme} />
            </div>

            <div
              style={{
                ...styles.reportGrid,
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              }}
            >
              <div style={{ ...styles.reportBox, background: theme.card, borderColor: theme.border }}>
                <h3>Преглед по тип</h3>

                <ReportLine label="Одмор" value={vacationCount} theme={theme} />
                <ReportLine label="Боледување" value={sickCount} theme={theme} />
                <ReportLine label="Нејавено отсуство" value={unexcusedCount} theme={theme} />
              </div>

              <div style={{ ...styles.reportBox, background: theme.card, borderColor: theme.border }}>
                <h3>Искористени денови по вработен</h3>

                {employees.map((emp) => (
                  <ReportLine
                    key={emp.id}
                    label={emp.full_name}
                    value={`${Number(emp.leave_days_used || 0)} дена`}
                    theme={theme}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={styles.version}>{VERSION}</div>
      </main>
    </div>
  )
}

function MenuItem({ active, onClick, children }) {
  return (
    <div
      style={{
        ...styles.menuItem,
        ...(active ? styles.menuItemActive : {}),
      }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

function Card({ children, theme }) {
  return (
    <div
      style={{
        ...styles.card,
        background: theme.card,
        borderColor: theme.border,
      }}
    >
      {children}
    </div>
  )
}

function Kpi({ icon, value, label, styleIcon, theme }) {
  return (
    <div
      style={{
        ...styles.kpiCard,
        background: theme.card,
        borderColor: theme.border,
      }}
    >
      <div style={styleIcon}>{icon}</div>
      <div>
        <h2 style={styles.kpiNumber}>{value}</h2>
        <div style={{ ...styles.kpiLabel, color: theme.muted }}>{label}</div>
      </div>
    </div>
  )
}

function ReportLine({ label, value, theme }) {
  return (
    <div style={{ ...styles.reportLine, borderColor: theme.line, color: theme.text }}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

const styles = {
  center: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shell: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: 'Arial',
  },
  sidebar: {
    width: 270,
    minHeight: '100vh',
    position: 'sticky',
    top: 0,
    background: 'linear-gradient(180deg, #061b2a 0%, #073344 45%, #0f766e 100%)',
    color: '#fff',
    padding: 22,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '10px 0 30px rgba(15,118,110,.18)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 35,
  },
  brandIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    background: 'linear-gradient(135deg, #5eead4, #0891b2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 900,
    boxShadow: '0 12px 24px rgba(94,234,212,.25)',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 13,
    color: '#9ff5ea',
    marginTop: 2,
  },
  menu: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  menuItem: {
    padding: '14px 15px',
    borderRadius: 13,
    color: '#d7fffa',
    fontWeight: 700,
    cursor: 'pointer',
    userSelect: 'none',
  },
  menuItemActive: {
    background: 'linear-gradient(135deg, #14b8a6, #0891b2)',
    color: '#fff',
    boxShadow: '0 12px 26px rgba(20,184,166,.28)',
  },
  sidebarUser: {
    marginTop: 'auto',
    padding: 14,
    borderRadius: 16,
    background: 'rgba(255,255,255,.11)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1px solid rgba(255,255,255,.12)',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    background: 'linear-gradient(135deg, #14b8a6, #5eead4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
  },
  sidebarRole: {
    fontSize: 12,
    color: '#b9fff6',
    marginTop: 3,
  },
  main: {
    flex: 1,
    padding: 26,
    maxWidth: 1550,
    margin: '0 auto',
    boxSizing: 'border-box',
    width: '100%',
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    marginBottom: 22,
  },
  pageTitle: {
    margin: 0,
    fontSize: 32,
    fontWeight: 900,
  },
  pageSubtitle: {
    marginTop: 6,
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 20,
  },
  kpiCard: {
    borderRadius: 18,
    padding: 20,
    border: '1px solid #d8eeee',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    boxShadow: '0 10px 30px rgba(15,118,110,.08)',
  },
  kpiIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    background: '#e6fffb',
    color: '#0f766e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
  },
  kpiIconGreen: {
    width: 54,
    height: 54,
    borderRadius: 16,
    background: '#dcfce7',
    color: '#16a34a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    fontWeight: 900,
  },
  kpiIconYellow: {
    width: 54,
    height: 54,
    borderRadius: 16,
    background: '#fef3c7',
    color: '#d97706',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
  },
  kpiIconRed: {
    width: 54,
    height: 54,
    borderRadius: 16,
    background: '#fee2e2',
    color: '#dc2626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 30,
    fontWeight: 900,
  },
  kpiNumber: {
    margin: 0,
    fontSize: 30,
  },
  kpiLabel: {
    marginTop: 4,
  },
  card: {
    padding: 20,
    borderRadius: 18,
    border: '1px solid #d8eeee',
    marginBottom: 20,
    boxShadow: '0 10px 30px rgba(15,118,110,.06)',
  },
  calendarCard: {
    borderRadius: 18,
    overflow: 'hidden',
    border: '1px solid #d8eeee',
    marginBottom: 20,
    boxShadow: '0 10px 30px rgba(15,118,110,.06)',
  },
  calendarTop: {
    padding: 20,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e5f5f5',
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
    color: '#0f766e',
    fontWeight: 800,
    fontSize: 18,
  },
  weekHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7,1fr)',
    textAlign: 'center',
    fontWeight: 'bold',
    padding: '10px 0',
    borderBottom: '1px solid #e5f5f5',
  },
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7,1fr)',
  },
  day: {
    minHeight: 120,
    borderRight: '1px solid #edf5f5',
    borderBottom: '1px solid #edf5f5',
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
    background: '#0f766e',
    color: '#fff',
    fontWeight: 700,
  },
  event: {
    color: '#fff',
    padding: '4px 6px',
    borderRadius: 8,
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
    borderRadius: 10,
    border: '1px solid #cfe8e8',
    boxSizing: 'border-box',
    outline: 'none',
  },
  button: {
    background: 'linear-gradient(135deg, #14b8a6, #0f766e)',
    color: '#fff',
    border: 'none',
    padding: '12px 20px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 800,
  },
  themeButton: {
    background: '#0f766e',
    color: '#fff',
    border: 'none',
    padding: '10px 14px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 800,
  },
  logout: {
    background: '#fff',
    border: '1px solid #0f766e',
    color: '#0f766e',
    padding: '10px 16px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 700,
  },
  passwordMini: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid #d8eeee',
    borderRadius: 12,
    padding: '8px 10px',
  },
  passwordInput: {
    width: 210,
    padding: '9px 10px',
    border: '1px solid #cfe8e8',
    borderRadius: 8,
    outline: 'none',
  },
  passwordButton: {
    padding: '9px 13px',
    borderRadius: 8,
    border: 'none',
    background: '#0f766e',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  leave: {
    display: 'flex',
    justifyContent: 'space-between',
    border: '1px solid #d8eeee',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  approve: {
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 9,
    cursor: 'pointer',
    fontWeight: 700,
  },
  reject: {
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 9,
    cursor: 'pointer',
    fontWeight: 700,
  },
  smallButton: {
    marginLeft: 8,
    padding: '8px 12px',
    borderRadius: 9,
    border: '1px solid #0f766e',
    background: '#fff',
    color: '#0f766e',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  employeeBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    border: '1px solid #d8eeee',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  muted: {
    fontSize: 13,
    marginTop: 4,
  },
  reportHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 10,
  },
  reportGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 16,
    marginTop: 20,
    marginBottom: 20,
  },
  reportBox: {
    border: '1px solid #d8eeee',
    borderRadius: 16,
    padding: 18,
  },
  reportLine: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid #eef7f7',
  },
  loginCard: {
    width: 380,
    padding: 30,
    borderRadius: 18,
    border: '1px solid #d8eeee',
    boxShadow: '0 20px 50px rgba(15,118,110,.13)',
  },
  loginLogo: {
    margin: 0,
    color: '#0f766e',
    fontSize: 42,
    fontWeight: 900,
  },
  loginSubtitle: {
    marginTop: 4,
    marginBottom: 22,
  },
  version: {
    position: 'fixed',
    right: 15,
    bottom: 10,
    fontSize: 12,
    color: '#777',
  },
}