import { useEffect, useMemo, useState } from 'react';

function getSkyPhase(hour) {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19.5) return 'dusk';
  return 'night';
}

const SKY_GRADIENTS = {
  night: 'linear-gradient(180deg, #05070d 0%, #0d1220 45%, #161b2e 100%)',
  dawn: 'linear-gradient(180deg, #1b2438 0%, #4a3a52 35%, #a85c4a 70%, #d98a5e 100%)',
  day: 'linear-gradient(180deg, #232e46 0%, #3d4f6b 55%, #5c6f89 100%)',
  dusk: 'linear-gradient(180deg, #1c1730 0%, #4a2e4a 30%, #8a3d4a 62%, #c9713f 100%)',
};

// Fixed pseudo-random star field so it doesn't reshuffle on every render.
const STARS = Array.from({ length: 45 }, (_, i) => {
  const seed = i * 137.5;
  return {
    top: (seed * 7.13) % 70, // keep stars in the upper sky
    left: (seed * 3.71) % 100,
    delay: (seed % 5).toFixed(1),
    size: 1 + (i % 3),
  };
});

export default function SkyBackground() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const hour = now.getHours() + now.getMinutes() / 60;
  const phase = getSkyPhase(hour);

  const arcPosition = (fraction) => ({
    top: `${78 - Math.sin(Math.max(0, Math.min(1, fraction)) * Math.PI) * 55}%`,
    left: `${8 + Math.max(0, Math.min(1, fraction)) * 84}%`,
  });

  const sunStyle = useMemo(() => {
    if (hour < 5.5 || hour > 18.5) return null;
    const fraction = (hour - 6) / 12;
    return arcPosition(fraction);
  }, [hour]);

  const moonStyle = useMemo(() => {
    const moonHour = hour < 6 ? hour + 24 : hour; // shift so the night arc is one continuous range
    if (moonHour < 18 || moonHour > 30) return null;
    const fraction = (moonHour - 18) / 12;
    return arcPosition(fraction);
  }, [hour]);

  const showStars = phase === 'night' || phase === 'dusk' || phase === 'dawn';

  return (
    <div className="sky-background" style={{ backgroundImage: SKY_GRADIENTS[phase] }}>
      {showStars && (
        <div className="sky-stars">
          {STARS.map((s, i) => (
            <span
              key={i}
              className="sky-star"
              style={{
                top: `${s.top}%`,
                left: `${s.left}%`,
                width: s.size,
                height: s.size,
                animationDelay: `${s.delay}s`,
              }}
            />
          ))}
        </div>
      )}
      {sunStyle && <div className="sky-sun" style={sunStyle} />}
      {moonStyle && <div className="sky-moon" style={moonStyle} />}
    </div>
  );
}
