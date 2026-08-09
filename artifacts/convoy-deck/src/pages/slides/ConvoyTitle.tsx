const base = import.meta.env.BASE_URL;

export default function ConvoyTitle() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{ backgroundColor: '#0C0F1A', fontFamily: "'Inter', sans-serif", color: '#FFFFFF' }}
    >
      {/* Blue glow — top right */}
      <div
        style={{
          position: 'absolute', top: '-20vh', right: '-10vw',
          width: '55vw', height: '55vw', borderRadius: '50%',
          backgroundColor: '#4F7FFF', opacity: 0.06, filter: 'blur(9vw)',
        }}
      />
      {/* Purple glow — bottom left */}
      <div
        style={{
          position: 'absolute', bottom: '-25vh', left: '-10vw',
          width: '55vw', height: '55vw', borderRadius: '50%',
          backgroundColor: '#7C6BF0', opacity: 0.06, filter: 'blur(11vw)',
        }}
      />

      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '4vw 4vw', opacity: 0.5, pointerEvents: 'none',
        }}
      />

      {/* Map image — right side with left-edge fade */}
      <div
        style={{
          position: 'absolute', right: 0, top: 0,
          width: '52vw', height: '100%', overflow: 'hidden',
        }}
      >
        <img
          src={`${base}cover-map.png`}
          crossOrigin="anonymous"
          alt="Live map view"
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65 }}
        />
        {/* Gradient fade to background on the left edge */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0, width: '55%', height: '100%',
            background: 'linear-gradient(to right, #0C0F1A 0%, rgba(12,15,26,0.6) 60%, transparent 100%)',
          }}
        />
        {/* Top fade */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '25%',
            background: 'linear-gradient(to bottom, #0C0F1A, transparent)',
          }}
        />
        {/* Bottom fade */}
        <div
          style={{
            position: 'absolute', bottom: 0, left: 0, width: '100%', height: '25%',
            background: 'linear-gradient(to top, #0C0F1A, transparent)',
          }}
        />
      </div>

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
          fontSize: '1vw', fontWeight: 400, color: 'rgba(255,255,255,0.4)', zIndex: 10,
        }}
      >
        2026
      </div>

      {/* Left content */}
      <div
        style={{
          position: 'absolute', left: '7vw', top: '50%', transform: 'translateY(-50%)',
          zIndex: 10, maxWidth: '47vw',
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '0.6vh 1.2vw',
            backgroundColor: 'rgba(124,107,240,0.15)',
            border: '1px solid rgba(124,107,240,0.3)',
            borderRadius: '2vw', color: '#7C6BF0',
            fontSize: '0.9vw', fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: '4vh',
          }}
        >
          Live Group Tracking
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '7.5vw', fontWeight: 800,
            margin: '0 0 2.5vh 0', lineHeight: 1.0,
            letterSpacing: '-0.04em',
          }}
        >
          Convoy
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '1.9vw', fontWeight: 300,
            color: 'rgba(255,255,255,0.65)',
            margin: '0 0 6vh 0', lineHeight: 1.5,
            textWrap: 'pretty',
          }}
        >
          One map. Every rider. Right now.
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: '1.2vw', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '1vh 1.4vw',
              backgroundColor: 'rgba(79,127,255,0.1)',
              border: '1px solid rgba(79,127,255,0.2)',
              borderRadius: '0.5vw',
              fontSize: '0.95vw', fontWeight: 500,
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            iOS + Android
          </div>
          <div
            style={{
              padding: '1vh 1.4vw',
              backgroundColor: 'rgba(79,127,255,0.1)',
              border: '1px solid rgba(79,127,255,0.2)',
              borderRadius: '0.5vw',
              fontSize: '0.95vw', fontWeight: 500,
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            No Sign-up Required
          </div>
          <div
            style={{
              padding: '1vh 1.4vw',
              backgroundColor: 'rgba(79,127,255,0.1)',
              border: '1px solid rgba(79,127,255,0.2)',
              borderRadius: '0.5vw',
              fontSize: '0.95vw', fontWeight: 500,
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            Real-Time
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: 'absolute', bottom: '5vh', left: '5vw',
          fontSize: '0.85vw', fontWeight: 400,
          color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em',
        }}
      >
        CONVOY, INC.
      </div>

      {/* Decorative UI card bottom-right */}
      <div
        style={{
          position: 'absolute', bottom: '8vh', right: '3vw',
          width: '18vw', height: '10vh',
          backgroundColor: '#131726',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '0.8vw',
          padding: '1.5vh 1.5vw',
          boxShadow: '0 2vh 4vh rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', gap: '1.2vh',
          transform: 'rotate(-4deg)',
          opacity: 0.85, zIndex: 11,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8vw' }}>
          <div style={{ width: '1.5vw', height: '1.5vw', borderRadius: '50%', backgroundColor: '#4F7FFF' }} />
          <div style={{ height: '0.7vw', width: '8vw', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.2vw' }} />
        </div>
        <div style={{ height: '0.6vw', width: '12vw', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '0.2vw' }} />
        <div style={{ height: '0.6vw', width: '9vw', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '0.2vw' }} />
      </div>
    </div>
  );
}
