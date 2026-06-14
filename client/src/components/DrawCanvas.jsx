import { forwardRef, useRef, useImperativeHandle, useEffect, useState } from 'react'

const COLORS = ['#ffffff', '#e94560', '#22c55e', '#3b82f6', '#fbbf24', '#000000']
const BG = '#1a1a2e'

const DrawCanvas = forwardRef(function DrawCanvas(props, ref) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const colorRef = useRef(COLORS[0])
  const lastPos = useRef({ x: 0, y: 0 })
  const [activeColor, setActiveColor] = useState(COLORS[0])

  const fillBackground = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  useEffect(() => {
    fillBackground()
  }, [])

  useImperativeHandle(ref, () => ({
    getDataUrl: () => canvasRef.current.toDataURL('image/png'),
    clear: () => fillBackground()
  }))

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    }
  }

  const start = (e) => {
    e.preventDefault()
    drawingRef.current = true
    lastPos.current = getPos(e)
  }

  const move = (e) => {
    if (!drawingRef.current) return
    e.preventDefault()
    const pos = getPos(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = colorRef.current
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  const end = () => { drawingRef.current = false }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <canvas
        ref={canvasRef}
        width={500}
        height={400}
        style={{
          width: '100%',
          maxWidth: '500px',
          aspectRatio: '5 / 4',
          borderRadius: '12px',
          touchAction: 'none',
          background: BG,
          border: '2px solid rgba(255,255,255,0.15)'
        }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => { colorRef.current = c; setActiveColor(c) }}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              border: activeColor === c ? '3px solid #e94560' : '2px solid rgba(255,255,255,0.25)',
              background: c,
              cursor: 'pointer'
            }}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>
    </div>
  )
})

export default DrawCanvas
