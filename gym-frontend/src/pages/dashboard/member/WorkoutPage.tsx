import {
  AimOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FireOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RightOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Progress,
  Spin,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useAuth } from '../../../hooks/useAuth'
import {
  workoutService,
  type WorkoutPlan,
  type WorkoutSession,
  type WorkoutExercise,
} from '../../../services/workoutService'
import { getUserDisplayName } from '../../../utils/userDisplay'

const { Text, Title } = Typography

const normalizeWorkoutList = (data: any): WorkoutPlan[] => {
  const list = data?.workouts || data?.data || data
  return Array.isArray(list) ? list : []
}

export default function WorkoutPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([])
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutPlan | null>(null)
  const [runningSessions, setRunningSessions] = useState<Set<string>>(new Set())
  const [elapsedTime, setElapsedTime] = useState<Record<string, number>>({})
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())
  const [restTimers, setRestTimers] = useState<Record<string, number>>({})
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<Record<string, number>>({})
  const [pausedSessions, setPausedSessions] = useState<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevRestTimers = useRef<Record<string, number>>({})

  const sessionProgress = useMemo(() => {
    if (!selectedWorkout?.weeks) return {}
    const progress: Record<string, number> = {}
    selectedWorkout.weeks.forEach((week, wi) => {
      week.sessions?.forEach((session, si) => {
        const sk = `${wi}-${si}`
        const total = session.exercises?.length || 0
        if (total === 0) {
          progress[sk] = 0
          return
        }
        let done = 0
        session.exercises.forEach((_, ei) => {
          if (completedExercises.has(`${sk}-${ei}`)) done++
        })
        progress[sk] = done >= total ? 100 : Math.round((done / total) * 100)
      })
    })
    return progress
  }, [completedExercises, selectedWorkout])

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } catch {
      // audio not supported
    }
  }

  useEffect(() => {
    const prev = prevRestTimers.current
    const toAdvance: string[] = []
    for (const key of Object.keys(restTimers)) {
      if (prev[key] === 1 && restTimers[key] === 0) {
        playBeep()
        toAdvance.push(key)
      }
    }
    for (const key of Object.keys(prev)) {
      if (!(key in restTimers) && prev[key] === 1) {
        playBeep()
        toAdvance.push(key)
      }
    }
    if (toAdvance.length > 0) {
      setCurrentExerciseIndex((prev) => {
        const next = { ...prev }
        for (const key of toAdvance) {
          const parts = key.split('-')
          const sessionKey = `${parts[0]}-${parts[1]}`
          next[sessionKey] = (next[sessionKey] ?? 0) + 1
        }
        return next
      })
    }
    prevRestTimers.current = { ...restTimers }
  }, [restTimers])

  useEffect(() => {
    if (runningSessions.size > 0 || Object.keys(restTimers).length > 0) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => {
          const next = { ...prev }
          runningSessions.forEach((key) => {
            if (!pausedSessions.has(key)) {
              next[key] = (next[key] || 0) + 1
            }
          })
          return next
        })
        setRestTimers((prev) => {
          const next = { ...prev }
          let changed = false
          for (const key of Object.keys(next)) {
            if (next[key] > 0) {
              const parts = key.split('-')
              const sessionKey = `${parts[0]}-${parts[1]}`
              if (!pausedSessions.has(sessionKey)) {
                next[key] = next[key] - 1
                changed = true
              }
            }
          }
          return changed ? next : prev
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [runningSessions.size, Object.keys(restTimers).length])

  const toggleSession = (key: string) => {
    const isStopping = runningSessions.has(key)
    if (isStopping) {
      setCompletedExercises((prev) => {
        const next = new Set(prev)
        for (const k of next) if (k.startsWith(`${key}-`)) next.delete(k)
        return next
      })
      setRestTimers((prev) => {
        const next = { ...prev }
        for (const k of Object.keys(next)) if (k.startsWith(`${key}-`)) delete next[k]
        return next
      })
    }
    setRunningSessions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
        setElapsedTime((e) => ({ ...e, [key]: 0 }))
        setCurrentExerciseIndex((e) => ({ ...e, [key]: 0 }))
      }
      return next
    })
  }

  const togglePause = (key: string) => {
    setPausedSessions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const parseRestSeconds = (restTime: string): number => {
    const trimmed = restTime.trim().toLowerCase()
    if (trimmed.endsWith('s')) return parseInt(trimmed, 10) || 60
    if (trimmed.endsWith('m')) return (parseInt(trimmed, 10) || 1) * 60
    const parts = trimmed.split(':')
    if (parts.length === 2) return parseInt(parts[0], 10) * 60 + (parseInt(parts[1], 10) || 0)
    return 60
  }

  const markExerciseDone = (sessionKey: string, exerciseIndex: number, restTime: string) => {
    const key = `${sessionKey}-${exerciseIndex}`
    setCompletedExercises((prev) => {
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      return next
    })
    setRestTimers((prev) => {
      if (prev[key] !== undefined) return prev
      return { ...prev, [key]: parseRestSeconds(restTime) }
    })
  }

  const loadWorkouts = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await workoutService.getWorkouts({ member: user?._id })
      const list = normalizeWorkoutList(data)
      setWorkouts(list)
      if (list.length > 0 && !selectedWorkout) {
        setSelectedWorkout(list[0])
      }
    } catch {
      setWorkouts([])
    } finally {
      setLoading(false)
    }
  }, [user?._id])

  useEffect(() => {
    if (user?._id) loadWorkouts()
  }, [user?._id, loadWorkouts])

  const ptName = selectedWorkout?.personalTrainer
    ? typeof selectedWorkout.personalTrainer === 'string'
      ? 'PT'
      : getUserDisplayName(selectedWorkout.personalTrainer, 'PT')
    : 'PT'

  const renderExercises = (exercises: WorkoutExercise[], sessionKey: string) =>
    exercises.map((ex, i) => {
      const exKey = `${sessionKey}-${i}`
      const isDone = completedExercises.has(exKey)
      const restRemaining = restTimers[exKey]
      const currentIdx = currentExerciseIndex[sessionKey] ?? 0
      const isCurrent = i === currentIdx
      return (
        <div
          key={i}
          className={`mb-2 rounded-lg border p-3 ${isCurrent ? 'border-[var(--gs-primary)] bg-[var(--gs-primary)]/5' : 'border-[var(--gs-border)] bg-[var(--gs-card)]'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1">
              <Text strong className="min-w-[140px]">{ex.name}</Text>
              <Tag>{ex.sets} x {ex.reps}</Tag>
              <span className="text-xs text-[var(--gs-text-muted)]">
                <ClockCircleOutlined className="mr-1" />Rest: {ex.restTime}
              </span>
              {ex.techniqueNote && (
                <Text type="secondary" className="text-xs italic">{ex.techniqueNote}</Text>
              )}
            </div>
            {!isDone && isCurrent ? (
              <Button
                size="small"
                type="primary"
                onClick={() => markExerciseDone(sessionKey, i, ex.restTime)}
              >
                Finish
              </Button>
            ) : isDone ? (
              <Tag color="green">Completed</Tag>
            ) : null}
          </div>
          {isDone && restRemaining !== undefined && restRemaining > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded bg-orange-50 px-3 py-1.5 dark:bg-orange-900/20">
              <ClockCircleOutlined className="text-orange-500" />
              <Text className="tabular-nums text-orange-600 dark:text-orange-400">
                Rest {formatTime(restRemaining)}
              </Text>
            </div>
          )}
        </div>
      )
    })

  const sessionItems = (sessions: WorkoutSession[], weekIndex: number) =>
    sessions.map((session, i) => {
      const sessionKey = `${weekIndex}-${i}`
      const isRunning = runningSessions.has(sessionKey)
      const isPaused = pausedSessions.has(sessionKey)
      return {
        key: String(i),
        label: (
          <span className="flex items-center justify-between">
            <span>
              <RightOutlined className="mr-2 text-[var(--gs-primary)]" />
              {session.sessionName || `Session ${i + 1}`}
            </span>
            <span className="flex items-center gap-2">
              <Button
                size="small"
                type={isRunning ? 'default' : 'primary'}
                icon={<PlayCircleOutlined />}
                onClick={(e) => { e.stopPropagation(); toggleSession(sessionKey) }}
              >
                {isRunning ? (isPaused ? 'Paused' : 'Running...') : 'Start'}
              </Button>
              {isRunning && (
                <Button
                  size="small"
                  icon={<PauseCircleOutlined />}
                  onClick={(e) => { e.stopPropagation(); togglePause(sessionKey) }}
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
              )}
            </span>
          </span>
        ),
        children: (
          <div>
            {isRunning && (
              <div className={`mb-3 flex items-center gap-2 rounded-lg px-4 py-2 ${isPaused ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-[var(--gs-primary)]/10'}`}>
                <ClockCircleOutlined className={`text-lg ${isPaused ? 'text-yellow-600 dark:text-yellow-400' : 'text-[var(--gs-primary)]'}`} />
                <Text strong className={`text-lg tabular-nums ${isPaused ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                  {formatTime(elapsedTime[sessionKey] || 0)}
                </Text>
                {isPaused && <Tag color="warning">Paused</Tag>}
              </div>
            )}
            {session.feedback && (
              <Text type="secondary" className="mb-2 block italic">"{session.feedback}"</Text>
            )}
            <div className="mb-3 flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--gs-border)] p-4">
              <Progress
                type="circle"
                percent={sessionProgress[sessionKey] ?? 0}
                size={80}
                strokeColor="var(--gs-primary)"
              />
              <Text type="secondary" className="mt-2 text-sm">Session Progress</Text>
            </div>
            {session.exercises?.length > 0 ? (
              renderExercises(session.exercises, sessionKey)
            ) : (
              <Text type="secondary">No exercises</Text>
            )}
          </div>
        ),
      }
    })

  const collapseItems = selectedWorkout?.weeks?.map((week, wi) => ({
    key: String(wi),
    label: (
      <span className="font-semibold">
        Week {week.weekNumber || wi + 1}
        <Tag className="ml-2">{week.sessions?.length || 0} sessions</Tag>
      </span>
    ),
    children: week.sessions?.length > 0 ? (
      <Collapse ghost items={sessionItems(week.sessions, wi)} />
    ) : (
      <Text type="secondary">No sessions</Text>
    ),
  })) || []

  return (
    <MemberLayout>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <style>{`.ant-progress-circle-path { transition: stroke-dashoffset 0.5s ease; }`}</style>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Title level={3} className="mb-1">My Workout Plan</Title>
            <Text type="secondary">View your personalized training plan</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadWorkouts} loading={loading}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center"><Spin size="large" /></div>
        ) : workouts.length === 0 ? (
          <Card>
            <Empty description="No workout plan assigned yet. Contact your PT to get started!" />
          </Card>
        ) : (
          <>
            {workouts.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {workouts.map((w) => (
                  <Button
                    key={w._id}
                    type={selectedWorkout?._id === w._id ? 'primary' : 'default'}
                    onClick={() => setSelectedWorkout(w)}
                  >
                    {w.workoutName}
                  </Button>
                ))}
              </div>
            )}

            {selectedWorkout && (
              <>
                <Card className="mb-6">
                  <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" bordered>
                    <Descriptions.Item label={<><AimOutlined className="mr-1" />Goal</>}>
                      <Tag color="blue">{selectedWorkout.goal || 'N/A'}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={<><CalendarOutlined className="mr-1" />Duration</>}>
                      {selectedWorkout.durationWeeks || selectedWorkout.weeks?.length || 0} weeks
                    </Descriptions.Item>
                    <Descriptions.Item label={<><FireOutlined className="mr-1" />Calories</>}>
                      {Number(selectedWorkout.estimatedCalories || 0).toLocaleString('vi-VN')} kcal
                    </Descriptions.Item>
                    <Descriptions.Item label={<><UserOutlined className="mr-1" />PT</>}>
                      {ptName}
                    </Descriptions.Item>
                    <Descriptions.Item label="Start">
                      {selectedWorkout.startDate ? dayjs(selectedWorkout.startDate).format('DD/MM/YYYY') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="End">
                      {selectedWorkout.endDate ? dayjs(selectedWorkout.endDate).format('DD/MM/YYYY') : '-'}
                    </Descriptions.Item>
                  </Descriptions>
                  {selectedWorkout.description && (
                    <div className="mt-4 rounded-lg bg-[var(--theme-bg)] p-4">
                      <Text type="secondary">{selectedWorkout.description}</Text>
                    </div>
                  )}
                </Card>

                <Collapse
                  defaultActiveKey={['0']}
                  items={collapseItems}
                  expandIconPosition="end"
                />
              </>
            )}
          </>
        )}
      </div>
    </MemberLayout>
  )
}
