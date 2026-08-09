export default function ConvoyCta() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{ backgroundColor: '#0C0F1A', fontFamily: "'Inter', sans-serif", color: '#FFFFFF' }}
    >
      {/* Center radial glow */}
      <div
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '65vw', height: '65vw', borderRadius: '50%',
          backgroundColor: '#4F7FFF', opacity: 0.07, filter: 'blur(15vw)',
        }}
      />
      {/* Purple glow — bottom-right */}
      <div
        style={{
          position: 'absolute', bottom: '-15vh', right: '-8vw',
          width: '40vw', height: '40vw', borderRadius: '50%',
          backgroundColor: '#7C6BF0', opacity: 0.09, filter: 'blur(9vw)',
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

      {/* Center card */}
      <div
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', textAlign: 'center',
          width: '52vw',
          padding: '5vh 5vw',
          backgroundColor: 'rgba(19,23,38,0.72)',
          backdropFilter: 'blur(2vw)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '2vw',
          boxShadow: '0 4vh 8vh rgba(0,0,0,0.55)',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: '4vw', height: '4vw',
            backgroundColor: '#4F7FFF',
            borderRadius: '1vw',
            marginBottom: '3vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0.8vh 2vh rgba(79,127,255,0.3)',
          }}
        >
          <svg width="2vw" height="2vw" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Headline */}
        <h2
          style={{
            fontSize: '4vw', fontWeight: 800,
            margin: '0 0 2vh 0',
            lineHeight: 1.05, letterSpacing: '-0.04em',
          }}
        >
          Start your next convoy
        </h2>

        {/* Tagline */}
        <p
          style={{
            fontSize: '1.5vw', fontWeight: 300,
            color: 'rgba(255,255,255,0.6)',
            margin: '0 0 4vh 0', lineHeight: 1.5,
            textWrap: 'balance',
          }}
        >
          Create a trip in 30 seconds. Share the code. Ride together.
        </p>

        {/* Bullet items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4vh', width: '100%' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '1vw',
              padding: '1.4vh 1.6vw',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '0.6vw',
              textAlign: 'left',
            }}
          >
            <div style={{ width: '0.55vw', height: '0.55vw', borderRadius: '50%', backgroundColor: '#4F7FFF', flexShrink: 0 }} />
            <span style={{ fontSize: '1.2vw', fontWeight: 400, color: 'rgba(255,255,255,0.82)' }}>
              Available on iOS and Android via Expo Go
            </span>
          </div>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '1vw',
              padding: '1.4vh 1.6vw',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '0.6vw',
              textAlign: 'left',
            }}
          >
            <div style={{ width: '0.55vw', height: '0.55vw', borderRadius: '50%', backgroundColor: '#4F7FFF', flexShrink: 0 }} />
            <span style={{ fontSize: '1.2vw', fontWeight: 400, color: 'rgba(255,255,255,0.82)' }}>
              No sign-up required for riders
            </span>
          </div>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '1vw',
              padding: '1.4vh 1.6vw',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: '0.6vw',
              textAlign: 'left',
            }}
          >
            <div style={{ width: '0.55vw', height: '0.55vw', borderRadius: '50%', backgroundColor: '#4F7FFF', flexShrink: 0 }} />
            <span style={{ fontSize: '1.2vw', fontWeight: 400, color: 'rgba(255,255,255,0.82)' }}>
              Free to use
            </span>
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
        05 / 05
      </div>
    </div>
  );
}
