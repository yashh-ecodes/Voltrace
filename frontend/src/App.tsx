import { lazy, Suspense, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { SEED_VERSION, useApp } from './store/app'
import { seedFleet } from './data/fleet'
import { refreshKeys } from './lib/passport'
import { TabBar, TourGuide } from './components/Shell'
import { Toaster } from './components/ui'
import { LogoMark, Logotype } from './components/visuals'
import Home from './screens/Home'

const ScanHub = lazy(() => import('./screens/ScanHub'))
const ScanRun = lazy(() => import('./screens/ScanRun'))
const LiveScan = lazy(() => import('./screens/LiveScan'))
const Battery = lazy(() => import('./screens/Battery'))
const Passports = lazy(() => import('./screens/Passports'))
const PassportDetail = lazy(() => import('./screens/PassportDetail'))
const Verify = lazy(() => import('./screens/Verify'))
const VerifyResult = lazy(() => import('./screens/VerifyResult'))
const Tamper = lazy(() => import('./screens/Tamper'))
const Fleet = lazy(() => import('./screens/Fleet'))
const FleetBattery = lazy(() => import('./screens/FleetBattery'))
const Analytics = lazy(() => import('./screens/Analytics'))
const Learn = lazy(() => import('./screens/Learn'))
const LearnTopic = lazy(() => import('./screens/LearnTopic'))
const Profile = lazy(() => import('./screens/Profile'))
const Settings = lazy(() => import('./screens/Settings'))
const Help = lazy(() => import('./screens/Help'))
const About = lazy(() => import('./screens/About'))
const ModelCard = lazy(() => import('./screens/ModelCard'))
const Notifications = lazy(() => import('./screens/Notifications'))
const DemoHub = lazy(() => import('./screens/DemoHub'))
const Diagnoses = lazy(() => import('./screens/Diagnoses'))

const NO_TABS = ['/scan/run', '/scan/live', '/v/']

function Frame() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  const withTabs = !NO_TABS.some((p) => pathname.startsWith(p))
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<ScanHub />} />
          <Route path="/scan/run/:profileId" element={<ScanRun />} />
          <Route path="/scan/live" element={<LiveScan />} />
          <Route path="/battery/:scanId" element={<Battery />} />
          <Route path="/battery/:scanId/:tab" element={<Battery />} />
          <Route path="/passports" element={<Passports />} />
          <Route path="/passport/:pid" element={<PassportDetail />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/verify/id/:pid" element={<VerifyResult />} />
          <Route path="/v/:token" element={<VerifyResult />} />
          <Route path="/tamper/:pid" element={<Tamper />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/fleet/:batteryId" element={<FleetBattery />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/learn/:topicId" element={<LearnTopic />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help" element={<Help />} />
          <Route path="/about" element={<About />} />
          <Route path="/model" element={<ModelCard />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/demo" element={<DemoHub />} />
          <Route path="/diagnoses" element={<Diagnoses />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {withTabs && <TabBar />}
      <TourGuide withTabs={withTabs} />
      <Toaster />
    </>
  )
}

function RouteFallback() {
  return <div className="flex h-[60dvh] items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-primary" /></div>
}

function Splash() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-bg">
      <LogoMark size={96} className="animate-fade-up" />
      <Logotype height={24} className="mt-3 animate-fade-up" />
      <p className="text-sm text-muted">Know Your Battery. Trust Its Future.</p>
    </div>
  )
}

export default function App() {
  const seeded = useApp((s) => s.seeded && s.seedVersion === SEED_VERSION)
  const hydrate = useApp((s) => s.hydrate)
  const [hydrated, setHydrated] = useState(useApp.persist.hasHydrated())

  useEffect(() => {
    const unsub = useApp.persist.onFinishHydration(() => setHydrated(true))
    setHydrated(useApp.persist.hasHydrated())
    refreshKeys()
    return unsub
  }, [])

  useEffect(() => {
    if (!hydrated || seeded) return
    let cancelled = false
    seedFleet().then(({ fleet, scans }) => !cancelled && hydrate(fleet, scans))
    return () => { cancelled = true }
  }, [hydrated, seeded, hydrate])

  // Public verification links must work instantly, even before demo data is seeded.
  const isVerifyLink = typeof window !== 'undefined' && window.location.hash.startsWith('#/v/')
  if (!isVerifyLink && (!hydrated || !seeded)) return <Splash />
  return (
    <HashRouter>
      <Frame />
    </HashRouter>
  )
}
