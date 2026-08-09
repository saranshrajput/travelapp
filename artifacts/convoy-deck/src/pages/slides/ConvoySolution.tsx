export default function ConvoySolution() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{ backgroundColor: '#0C0F1A', fontFamily: "'Inter', sans-serif", color: '#FFFFFF' }}
    >
      {/* Purple glow — center-left */}
      <div
        style={{
          position: 'absolute', top: '10vh', left: '15vw',
          width: '45vw', height: '45vw', borderRadius: '50%',
          backgroundColor: '#7C6BF0', opacity: 0.07, filter: 'blur(12vw)',
        }}
      />
      {/* Blue glow — bottom-right */}
      <div
        style={{
          position: 'absolute', bottom: '5vh', right: '5vw',
          width: '40vw', height: '40vw', borderRadius: '50%',
          backgroundColor: '#4F7FFF', opacity: 0.05, filter: 'blur(10vw)',
        }}
      />
      {/* Grid */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '4vw 4vw', opacity: 0.5, pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div
        style={{
          position: 'absolute', top: '5vh', left: '5vw',
          display: 'flex', alignItems: 'center', gap: '0.8vw', zIndex: 10,
        }}
      >
        <div style={{ width: '1.8vw', height: '1.8vw', backgroundColor: '#4F7FFF', borderRadius: '0.4vw' }} />
        <div style={{ fontSize: '1.1vw', fontWeight: 700, letterSpacing: '-0.02em' }}>Convoy</div>
      </div>
      <div
        style={{
          position: 'absolute', top: '5vh', right: '5vw',
          fontSize: '1vw', color: 'rgba(255,255,255,0.4)', zIndex: 10,
        }}
      >
        2026
      </div>

      {/* Main content */}
      <div
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100%', padding: '0 8vw',
        }}
      >
        {/* Title block */}
        <div style={{ textAlign: 'center', marginBottom: '5.5vh' }}>
          <div
            style={{
              display: 'inline-block', padding: '0.5vh 1.2vw',
              backgroundColor: 'rgba(79,127,255,0.15)',
              border: '1px solid rgba(79,127,255,0.3)',
              borderRadius: '2vw', color: '#4F7FFF',
              fontSize: '0.85vw', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: '2.5vh',
            }}
          >
            The Solution
          </div>
          <h2
            style={{
              fontSize: '3.8vw', fontWeight: 800, margin: 0,
              lineHeight: 1.1, letterSpacing: '-0.03em', textWrap: 'balance',
            }}
          >
            Everyone on one live map —
            <span style={{ color: 'rgba(255,255,255,0.4)' }}> instantly.</span>
          </h2>
        </div>

        {/* 2x2 solution cards */}
        <div
          style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '2vh 3vw', width: '100%', maxWidth: '72vw',
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              backgroundColor: '#131726',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.9vw', padding: '2.5vh 2.2vw',
              display: 'flex', gap: '1.2vw', alignItems: 'flex-start',
            }}
          >
            <div style={{ marginTop: '0.25vh', flexShrink: 0 }}>
              <svg width="1.3vw" height="1.3vw" viewBox="0 0 24 24" fill="none" stroke="#7C6BF0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ fontSize: '1.15vw', fontWeight: 600, margin: 0, lineHeight: 1.45, textWrap: 'pretty' }}>
              Leader creates a trip and shares a 6-character code
            </p>
          </div>
          {/* Card 2 */}
          <div
            style={{
              backgroundColor: '#131726',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.9vw', padding: '2.5vh 2.2vw',
              display: 'flex', gap: '1.2vw', alignItems: 'flex-start',
            }}
          >
            <div style={{ marginTop: '0.25vh', flexShrink: 0 }}>
              <svg width="1.3vw" height="1.3vw" viewBox="0 0 24 24" fill="none" stroke="#7C6BF0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ fontSize: '1.15vw', fontWeight: 600, margin: 0, lineHeight: 1.45, textWrap: 'pretty' }}>
              Riders join with just their name and phone — no account needed
            </p>
          </div>
          {/* Card 3 */}
          <div
            style={{
              backgroundColor: '#131726',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.9vw', padding: '2.5vh 2.2vw',
              display: 'flex', gap: '1.2vw', alignItems: 'flex-start',
            }}
          >
            <div style={{ marginTop: '0.25vh', flexShrink: 0 }}>
              <svg width="1.3vw" height="1.3vw" viewBox="0 0 24 24" fill="none" stroke="#7C6BF0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ fontSize: '1.15vw', fontWeight: 600, margin: 0, lineHeight: 1.45, textWrap: 'pretty' }}>
              Everyone sees the full convoy: live positions, route line, and real-time gaps
            </p>
          </div>
          {/* Card 4 */}
          <div
            style={{
              backgroundColor: '#131726',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.9vw', padding: '2.5vh 2.2vw',
              display: 'flex', gap: '1.2vw', alignItems: 'flex-start',
            }}
          >
            <div style={{ marginTop: '0.25vh', flexShrink: 0 }}>
              <svg width="1.3vw" height="1.3vw" viewBox="0 0 24 24" fill="none" stroke="#7C6BF0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ fontSize: '1.15vw', fontWeight: 600, margin: 0, lineHeight: 1.45, textWrap: 'pretty' }}>
              Color-coded markers show each rider's status: Moving, Stopped, or Not sharing
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute', bottom: '5vh', left: '5vw',
          fontSize: '0.85vw', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em',
        }}
      >
        CONVOY, INC.
      </div>
      <div
        style={{
          position: 'absolute', bottom: '5vh', right: '5vw',
          fontSize: '0.85vw', color: 'rgba(255,255,255,0.35)',
        }}
      >
        03 / 05
      </div>
    </div>
  );
}
