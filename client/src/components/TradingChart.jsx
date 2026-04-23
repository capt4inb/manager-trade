import { useEffect, useRef } from 'react'
import { createChart, ColorType } from 'lightweight-charts'

export default function TradingChart({ symbol, interval = '15m' }) {
  const chartContainerRef = useRef()

  useEffect(() => {
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth })
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })

    // Fetch data
    fetch(`/api/market/kline?symbol=${symbol}&interval=${interval}&limit=100`)
      .then(r => r.json())
      .then(json => {
        if (json.code === 0 && Array.isArray(json.data)) {
          // Bitunix returns data in a certain order, ensure it's sorted by time ascending
          const formattedData = json.data
            .map(d => ({
              time: Math.floor(Number(d.time) / 1000), // convert to seconds
              open: parseFloat(d.open),
              high: parseFloat(d.high),
              low: parseFloat(d.low),
              close: parseFloat(d.close),
            }))
            .sort((a, b) => a.time - b.time)

          candlestickSeries.setData(formattedData)
          chart.timeScale().fitContent()
        }
      })

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [symbol, interval])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, pointerEvents: 'none' }}>
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#e2e8f0' }}>{symbol}</span>
        <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '10px' }}>{interval}</span>
      </div>
      <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />
    </div>
  )
}
