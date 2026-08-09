export default function ConvoyProblem() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{ backgroundColor: '#0C0F1A', fontFamily: "'Inter', sans-serif", color: '#FFFFFF' }}
    >
      {/* Glow blobs */}
      <div
        style={{
          position: 'absolute', top: '-15vh', right: '-8vw',
          width: '45vw', height: '45vw', borderRadius: '50%',
          backgroundColor: '#4F7FFF', opacity: 0.04, filter: 'blur(9vw)',
        }}
      />
      <div
        style={{
          position: 'absolute', bottom: '-25vh', left: '-10vw',
          width: '50vw', height: '50vw', borderRadius: '50%',
          backgroundColor: '#7C6BF0', opacity: 0.04, filter: 'blur(10vw)',
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

      {/* Content — split layout */}
      <div
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', width: '88vw', margin: '0 auto',
          height: '100%', alignItems: 'center', gap: '5vw',
        }}
      >
        {/* Left: problem text */}
        <div style={{ flex: 1.1, display: 'flex', flexDirection: 'column', gap: '2.8vh' }}>
          {/* Badge */}
          <div
            style={{
              display: 'inline-block', padding: '0.5vh 1.1vw',
              backgroundColor: 'rgba(79,127,255,0.15)',
              border: '1px solid rgba(79,127,255,0.3)',
              borderRadius: '2vw', color: '#4F7FFF',
              fontSize: '0.85vw', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              alignSelf: 'flex-start',
            }}
          >
            The Problem
          </div>

          {/* Headline */}
          <h2
            style={{
              fontSize: '3vw', fontWeight: 800, margin: 0,
              lineHeight: 1.15, letterSpacing: '-0.03em',
            }}
          >
            Group trips fall apart
            <span
              style={{
                display: 'block',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              in the group chat.
            </span>
          </h2>

          {/* Bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2vh', marginTop: '0.5vh' }}>
            {/* Bullet 1 */}
            <div style={{ display: 'flex', gap: '1vw', alignItems: 'flex-start' }}>
              <div style={{ marginTop: '0.35vh', flexShrink: 0 }}>
                <svg width="1.3vw" height="1.3vw" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p style={{ fontSize: '1.15vw', fontWeight: 500, margin: 0, lineHeight: 1.45, color: 'rgba(255,255,255,0.85)', textWrap: 'pretty' }}>
                "Where are you?" sent 47 times on every road trip
              </p>
            </div>
            {/* Bullet 2 */}
            <div style={{ display: 'flex', gap: '1vw', alignItems: 'flex-start' }}>
              <div style={{ marginTop: '0.35vh', flexShrink: 0 }}>
                <svg width="1.3vw" height="1.3vw" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p style={{ fontSize: '1.15vw', fontWeight: 500, margin: 0, lineHeight: 1.45, color: 'rgba(255,255,255,0.85)', textWrap: 'pretty' }}>
                No one knows who's ahead, who's behind, or who's stopped
              </p>
            </div>
            {/* Bullet 3 */}
            <div style={{ display: 'flex', gap: '1vw', alignItems: 'flex-start' }}>
              <div style={{ marginTop: '0.35vh', flexShrink: 0 }}>
                <svg width="1.3vw" height="1.3vw" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p style={{ fontSize: '1.15vw', fontWeight: 500, margin: 0, lineHeight: 1.45, color: 'rgba(255,255,255,0.85)', textWrap: 'pretty' }}>
                Critical updates get buried in memes and voice notes
              </p>
            </div>
            {/* Bullet 4 */}
            <div style={{ display: 'flex', gap: '1vw', alignItems: 'flex-start' }}>
              <div style={{ marginTop: '0.35vh', flexShrink: 0 }}>
                <svg width="1.3vw" height="1.3vw" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p style={{ fontSize: '1.15vw', fontWeight: 500, margin: 0, lineHeight: 1.45, color: 'rgba(255,255,255,0.85)', textWrap: 'pretty' }}>
                One wrong turn and the group is split for hours
              </p>
            </div>
          </div>
        </div>

        {/* Right: group chat mockup */}
        <div style={{ flex: 0.9, height: '72vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: '88%', height: '95%',
              backgroundColor: '#131726',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '1.2vw', overflow: 'hidden',
              boxShadow: '0 2vh 5vh rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Chat window chrome */}
            <div
              style={{
                padding: '1.4vh 1.4vw', borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', gap: '0.6vw',
                backgroundColor: '#0f1424',
              }}
            >
              <div style={{ width: '0.65vw', height: '0.65vw', borderRadius: '50%', backgroundColor: '#FF5F56' }} />
              <div style={{ width: '0.65vw', height: '0.65vw', borderRadius: '50%', backgroundColor: '#FFBD2E' }} />
              <div style={{ width: '0.65vw', height: '0.65vw', borderRadius: '50%', backgroundColor: '#27C93F' }} />
              <div style={{ marginLeft: '1vw', fontSize: '0.85vw', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
                Bangalore Trip — Group
              </div>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1, padding: '2vh 1.4vw',
                display: 'flex', flexDirection: 'column', gap: '1.4vh',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.3vh' }}>
                <div style={{ fontSize: '0.7vw', color: 'rgba(255,255,255,0.28)', paddingLeft: '0.4vw' }}>Rahul</div>
                <div style={{ backgroundColor: '#1d2236', padding: '0.8vh 0.9vw', borderRadius: '0 0.6vw 0.6vw 0.6vw', fontSize: '0.95vw', color: 'rgba(255,255,255,0.82)', maxWidth: '78%' }}>
                  Where are you guys?
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3vh' }}>
                <div style={{ fontSize: '0.7vw', color: 'rgba(255,255,255,0.28)', paddingRight: '0.4vw' }}>Priya</div>
                <div style={{ backgroundColor: '#1b2f50', padding: '0.8vh 0.9vw', borderRadius: '0.6vw 0 0.6vw 0.6vw', fontSize: '0.95vw', color: 'rgba(255,255,255,0.82)', maxWidth: '78%' }}>
                  Still on the highway, lost track after the toll
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.3vh' }}>
                <div style={{ fontSize: '0.7vw', color: 'rgba(255,255,255,0.28)', paddingLeft: '0.4vw' }}>Karan</div>
                <div style={{ backgroundColor: '#1d2236', padding: '0.8vh 0.9vw', borderRadius: '0 0.6vw 0.6vw 0.6vw', fontSize: '0.95vw', color: 'rgba(255,255,255,0.82)', maxWidth: '78%' }}>
                  Where are you??
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.3vh' }}>
                <div style={{ fontSize: '0.7vw', color: 'rgba(255,255,255,0.28)', paddingLeft: '0.4vw' }}>Rahul</div>
                <div style={{ backgroundColor: '#1d2236', padding: '0.8vh 0.9vw', borderRadius: '0 0.6vw 0.6vw 0.6vw', fontSize: '0.95vw', color: 'rgba(255,255,255,0.82)', maxWidth: '78%' }}>
                  Wait I took a wrong turn
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3vh' }}>
                <div style={{ fontSize: '0.7vw', color: 'rgba(255,255,255,0.28)', paddingRight: '0.4vw' }}>Priya</div>
                <div style={{ backgroundColor: '#1b2f50', padding: '0.8vh 0.9vw', borderRadius: '0.6vw 0 0.6vw 0.6vw', fontSize: '0.95vw', color: 'rgba(255,255,255,0.82)', maxWidth: '78%' }}>
                  WHERE ARE YOU GUYS
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.3vh' }}>
                <div style={{ fontSize: '0.7vw', color: 'rgba(255,255,255,0.28)', paddingLeft: '0.4vw' }}>Karan</div>
                <div style={{ backgroundColor: '#1d2236', padding: '0.8vh 0.9vw', borderRadius: '0 0.6vw 0.6vw 0.6vw', fontSize: '0.95vw', color: 'rgba(255,255,255,0.82)', maxWidth: '78%' }}>
                  I'm at the petrol pump, where is everyone
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '0.5vh' }} />
              <div style={{ textAlign: 'center', fontSize: '0.78vw', color: 'rgba(255,255,255,0.22)', fontStyle: 'italic' }}>
                47 more messages...
              </div>
            </div>
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
          fontSize: '0.85vw', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em',
        }}
      >
        02 / 05
      </div>
    </div>
  );
}
