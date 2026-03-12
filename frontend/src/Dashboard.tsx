import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js'
import { Bar, Pie, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
)

interface ScoreBucket {
  bucket: string
  count: number
}

interface PassRate {
  task: string
  avg_score: number
  attempts: number
}

interface TimelineEntry {
  date: string
  submissions: number
}

interface GroupStats {
  group: string
  avg_score: number
  students: number
}

interface DashboardProps {
  token: string
}

interface LabOption {
  value: string
  label: string
}

const LABS: LabOption[] = [
  { value: 'lab-01', label: 'Lab 01' },
  { value: 'lab-02', label: 'Lab 02' },
  { value: 'lab-03', label: 'Lab 03' },
  { value: 'lab-04', label: 'Lab 04' },
  { value: 'lab-05', label: 'Lab 05' },
  { value: 'lab-06', label: 'Lab 06' },
]

export default function Dashboard({ token }: DashboardProps) {
  const [selectedLab, setSelectedLab] = useState<string>('lab-05')
  const [scoreData, setScoreData] = useState<ScoreBucket[]>([])
  const [passRateData, setPassRateData] = useState<PassRate[]>([])
  const [timelineData, setTimelineData] = useState<TimelineEntry[]>([])
  const [groupData, setGroupData] = useState<GroupStats[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const fetchAnalytics = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` }

        const [scoresRes, passRatesRes, timelineRes, groupsRes] = await Promise.all([
          fetch(`/analytics/scores?lab=${selectedLab}`, { headers }),
          fetch(`/analytics/pass-rates?lab=${selectedLab}`, { headers }),
          fetch(`/analytics/timeline?lab=${selectedLab}`, { headers }),
          fetch(`/analytics/groups?lab=${selectedLab}`, { headers }),
        ])

        if (!scoresRes.ok) throw new Error(`Scores: HTTP ${scoresRes.status}`)
        if (!passRatesRes.ok) throw new Error(`Pass rates: HTTP ${passRatesRes.status}`)
        if (!timelineRes.ok) throw new Error(`Timeline: HTTP ${timelineRes.status}`)
        if (!groupsRes.ok) throw new Error(`Groups: HTTP ${groupsRes.status}`)

        const scores: ScoreBucket[] = await scoresRes.json()
        const passRates: PassRate[] = await passRatesRes.json()
        const timeline: TimelineEntry[] = await timelineRes.json()
        const groups: GroupStats[] = await groupsRes.json()

        setScoreData(scores)
        setPassRateData(passRates)
        setTimelineData(timeline)
        setGroupData(groups)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [token, selectedLab])

  const barChartData = {
    labels: scoreData.map((s) => s.bucket),
    datasets: [
      {
        label: 'Number of Students',
        data: scoreData.map((s) => s.count),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(54, 162, 235, 0.6)',
        ],
        borderColor: [
          'rgb(255, 99, 132)',
          'rgb(255, 159, 64)',
          'rgb(75, 192, 192)',
          'rgb(54, 162, 235)',
        ],
        borderWidth: 1,
      },
    ],
  }

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Score Distribution',
      },
    },
  }

  const pieChartData = {
    labels: groupData.map((g) => g.group),
    datasets: [
      {
        label: 'Students per Group',
        data: groupData.map((g) => g.students),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 205, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(199, 199, 199, 0.6)',
          'rgba(83, 102, 255, 0.6)',
          'rgba(255, 99, 255, 0.6)',
          'rgba(99, 255, 132, 0.6)',
          'rgba(255, 200, 100, 0.6)',
        ],
        borderColor: [
          'rgb(255, 99, 132)',
          'rgb(54, 162, 235)',
          'rgb(255, 205, 86)',
          'rgb(75, 192, 192)',
          'rgb(153, 102, 255)',
          'rgb(255, 159, 64)',
          'rgb(199, 199, 199)',
          'rgb(83, 102, 255)',
          'rgb(255, 99, 255)',
          'rgb(99, 255, 132)',
          'rgb(255, 200, 100)',
        ],
        borderWidth: 1,
      },
    ],
  }

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: true,
        text: 'Students per Group',
      },
    },
  }

  const lineChartData = {
    labels: timelineData.map((t) => t.date),
    datasets: [
      {
        label: 'Submissions',
        data: timelineData.map((t) => t.submissions),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1,
      },
    ],
  }

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Submissions Timeline',
      },
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  }

  const passRateChartData = {
    labels: passRateData.map((p) => p.task.length > 20 ? p.task.substring(0, 20) + '...' : p.task),
    datasets: [
      {
        label: 'Average Score',
        data: passRateData.map((p) => p.avg_score),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1,
      },
    ],
  }

  const passRateChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Average Scores by Task',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
  }

  if (loading) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <p>Loading analytics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <p className="error">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Analytics Dashboard</h1>
        <select
          value={selectedLab}
          onChange={(e) => setSelectedLab(e.target.value)}
          className="lab-selector"
        >
          {LABS.map((lab) => (
            <option key={lab.value} value={lab.value}>
              {lab.label}
            </option>
          ))}
        </select>
      </header>

      <div className="charts-grid">
        <div className="chart-container">
          <Bar data={barChartData} options={barChartOptions} />
        </div>

        <div className="chart-container">
          <Pie data={pieChartData} options={pieChartOptions} />
        </div>

        <div className="chart-container full-width">
          <Line data={lineChartData} options={lineChartOptions} />
        </div>

        <div className="chart-container full-width">
          <Bar data={passRateChartData} options={passRateChartOptions} />
        </div>
      </div>
    </div>
  )
}
