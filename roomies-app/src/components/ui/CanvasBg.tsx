export default function CanvasBg() {
  return (
    <div className="canvas-bg">
      <div className="canvas-orb orb-blue"  style={{ width: 700, height: 700, top: '-15%', left: '-10%' }} />
      <div className="canvas-orb orb-mint"  style={{ width: 600, height: 600, bottom: '-10%', right: '-5%', animationDelay: '4s' }} />
      <div className="canvas-orb orb-violet" style={{ width: 500, height: 500, top: '40%', left: '50%', animationDelay: '8s' }} />
    </div>
  )
}
