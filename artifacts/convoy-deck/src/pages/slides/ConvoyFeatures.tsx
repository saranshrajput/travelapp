export default function ConvoyFeatures() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{ backgroundColor: '#0C0F1A', fontFamily: "'Inter', sans-serif", color: '#FFFFFF' }}
    >
      {/* Purple glow — top-center */}
      <div
        style={{
          position: 'absolute', top: '5vh', left: '25vw',
          width: '50vw', height: '50vw', borderRadius: '50%',
          backgroundColor: '#7C6BF0', opacity: 0.06, filter: 'blur(13vw)',
        }}
      />
      {/* Blue glow — bottom-right */}
      <div
        style={{
          position: 'absolute', bottom: '0', right: '10vw',
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
          height: '100%', padding: '0 7vw',
        }}
      >
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '5vh' }}>
          <div
            style={{
              display: 'inline-block', padding: '0.5vh 1.2vw',
              backgroundColor: 'rgba(124,107,240,0.15)',
              border: '1px solid rgba(124,107,240,0.3)',
              borderRadius: '2vw', color: '#7C6BF0',
              fontSize: '0.85vw', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: '2.5vh',
            }}
          >
            Features
          </div>
          <h2
            style={{
              fontSize: '3.8vw', fontWeight: 800, margin: 0,
              lineHeight: 1.1, letterSpacing: '-0.03em',
            }}
          >
            Built for real road trips
          </h2>
        </div>

        {/* 2x2 feature cards */}
        <div
          style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '2vh 2.5vw', width: '100%',
          }}
        >
          {/* Feature 1 — Route gaps */}
          <div
            style={{
              backgroundColor: '#131726',
              border: '1px solid rgba(79,127,255,0.2)',
              borderRadius: '1vw', padding: '2.8vh 2.4vw',
            }}
          >
            <div
              style={{
                width: '2.8vw', height: '2.8vw',
                backgroundColor: 'rgba(79,127,255,0.15)',
                borderRadius: '0.6vw',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '2vh',
              }}
            >
              <svg width="1.4vw" height="1.4vw" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <h3
              style={{
                fontSize: '1.35vw', fontWeight: 700,
                margin: '0 0 0.9vh 0', lineHeight: 1.2,
              }}
            >
              Route-based gap calculation
            </h3>
            <p
              style={{
                fontSize: '1.05vw', fontWeight: 400,
                color: 'rgba(255,255,255,0.52)', margin: 0, lineHeight: 1.55,
                textWrap: 'pretty',
              }}
            >
              Distance and estimated time to regroup, shown for every rider along the route
            </p>
          </div>

          {/* Feature 2 — Messaging */}
          <div
            style={{
              backgroundColor: '#131726',
              border: '1px solid rgba(124,107,240,0.2)',
              borderRadius: '1vw', padding: '2.8vh 2.4vw',
            }}
          >
            <div
              style={{
                width: '2.8vw', height: '2.8vw',
                backgroundColor: 'rgba(124,107,240,0.15)',
                borderRadius: '0.6vw',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '2vh',
              }}
            >
              <svg width="1.4vw" height="1.4vw" viewBox="0 0 24 24" fill="none" stroke="#7C6BF0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3
              style={{
                fontSize: '1.35vw', fontWeight: 700,
                margin: '0 0 0.9vh 0', lineHeight: 1.2,
              }}
            >
              In-app group and direct messaging
            </h3>
            <p
              style={{
                fontSize: '1.05vw', fontWeight: 400,
                color: 'rgba(255,255,255,0.52)', margin: 0, lineHeight: 1.55,
                textWrap: 'pretty',
              }}
            >
              No WhatsApp needed — chat stays inside the trip, with the map always one swipe away
            </p>
          </div>

          {/* Feature 3 — Pitstop */}
          <div
            style={{
              backgroundColor: '#131726',
              border: '1px solid rgba(39,201,63,0.2)',
              borderRadius: '1vw', padding: '2.8vh 2.4vw',
            }}
          >
            <div
              style={{
                width: '2.8vw', height: '2.8vw',
                backgroundColor: 'rgba(39,201,63,0.12)',
                borderRadius: '0.6vw',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '2vh',
              }}
            >
              <svg width="1.4vw" height="1.4vw" viewBox="0 0 24 24" fill="none" stroke="#27C93F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3
              style={{
                fontSize: '1.35vw', fontWeight: 700,
                margin: '0 0 0.9vh 0', lineHeight: 1.2,
              }}
            >
              Pitstop coordination
            </h3>
            <p
              style={{
                fontSize: '1.05vw', fontWeight: 400,
                color: 'rgba(255,255,255,0.52)', margin: 0, lineHeight: 1.55,
                textWrap: 'pretty',
              }}
            >
              Leader drops a pin, everyone sees it instantly and confirms they're on the way
            </p>
          </div>

          {/* Feature 4 — Call */}
          <div
            style={{
              backgroundColor: '#131726',
              border: '1px solid rgba(79,127,255,0.15)',
              borderRadius: '1vw', padding: '2.8vh 2.4vw',
            }}
          >
            <div
              style={{
                width: '2.8vw', height: '2.8vw',
                backgroundColor: 'rgba(79,127,255,0.1)',
                borderRadius: '0.6vw',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '2vh',
              }}
            >
              <svg width="1.4vw" height="1.4vw" viewBox="0 0 24 24" fill="none" stroke="#4F7FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.36 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l.86-.86a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <h3
              style={{
                fontSize: '1.35vw', fontWeight: 700,
                margin: '0 0 0.9vh 0', lineHeight: 1.2,
              }}
            >
              One-tap call from any member's detail sheet
            </h3>
            <p
              style={{
                fontSize: '1.05vw', fontWeight: 400,
                color: 'rgba(255,255,255,0.52)', margin: 0, lineHeight: 1.55,
                textWrap: 'pretty',
              }}
            >
              Tap any rider to see their gap, locate them on the map, or call directly
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
        04 / 05
      </div>
    </div>
  );
}
