/**
 * Rally design tokens.
 *
 * Palette strategy: Ola-inspired brand chrome (deep charcoal ink + citrus
 * lime) for app surfaces and primary actions, with Google-Maps-derived
 * colors reserved for the map layer and status meaning (route blue, moving
 * green, stopped amber, alert red, stale grey). Color always carries
 * information: lime = "your action", blue = "the route / you on the map",
 * green/amber/grey = member state.
 *
 * Light-only on purpose: high-contrast light UI reads best in sunlight
 * from a phone mount.
 */

const colors = {
  light: {
    // Legacy aliases
    text: '#161A16',
    tint: '#5C8001',

    // Core surfaces — warm off-white, high contrast ink
    background: '#F4F6F0',
    foreground: '#161A16',

    card: '#FFFFFF',
    cardForeground: '#161A16',

    // Primary action: Ola citrus lime with near-black text (7:1+)
    primary: '#B7DF2F',
    primaryForeground: '#141A05',

    secondary: '#E7ECDD',
    secondaryForeground: '#242B1E',

    muted: '#ECEFE5',
    mutedForeground: '#66705E',

    accent: '#E4F3B5',
    accentForeground: '#2B3A05',

    destructive: '#D93025',
    destructiveForeground: '#FFFFFF',

    border: '#DCE1D2',
    input: '#DCE1D2',

    // Brand chrome (Ola ink) — headers, hero surfaces
    ink: '#171D18',
    inkForeground: '#F4F6F0',
    inkMuted: '#9BA694',
    lime: '#C6E84E',

    // Map / status language (Google Maps derived) — informational only
    mapRoute: '#4285F4',
    mapRouteAlt: '#BDC1C6',
    statusMoving: '#188038',
    statusStopped: '#F29900',
    statusStale: '#9AA0A6',
    statusDanger: '#D93025',
    water: '#AECBFA',
  },

  radius: 14,
};

export default colors;
