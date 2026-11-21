import { useEffect, useId, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ScannerHandle {
  stop: () => Promise<void>
  clear: () => void
  isScanning: boolean
}

/** Camera QR reader. Calls onScan once per successful read, then stops the camera. */
export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const elementId = `qr-${useId().replace(/:/g, '')}`
  const scannerRef = useRef<ScannerHandle | null>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stop = async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    setActive(false)
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop()
        scanner.clear()
      } catch { /* already stopped */ }
    }
  }

  const start = async () => {
    setError(null)
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('The camera needs a secure (https) connection. Type the pass code below instead.')
      return
    }
    setActive(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode(elementId)
      scannerRef.current = scanner as unknown as ScannerHandle
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => { void stop(); onScanRef.current(text) },
        () => { /* no QR in this frame */ },
      )
    } catch (e) {
      await stop()
      const name = e instanceof Error ? e.name : ''
      setError(
        name === 'NotAllowedError' || String(e).includes('NotAllowed')
          ? 'Camera access was blocked. Allow the camera for this site in your browser, or type the pass code below.'
          : 'Could not start the camera. Type the pass code below instead.',
      )
    }
  }

  useEffect(() => () => { void stop() }, [])

  return (
    <div className="space-y-3">
      <div id={elementId} className={active ? 'overflow-hidden rounded-md border bg-black [&_video]:w-full' : 'hidden'} />
      {active ? (
        <Button variant="outline" className="w-full" onClick={() => void stop()}><CameraOff className="h-4 w-4" /> Stop camera</Button>
      ) : (
        <Button className="w-full h-12 text-base" onClick={() => void start()}><Camera className="h-5 w-5" /> Scan QR with camera</Button>
      )}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  )
}
