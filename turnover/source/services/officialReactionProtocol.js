const OFFICIAL_REACTION_MINUTES = Object.freeze({
  SA: 1,
  SB: 20,
  A: 20,
});

const SAMPLE_CLASS_ALIASES = Object.freeze({ AA: 'SA', C: 'SB' });

export function officialReactionInstruction(sampleClass) {
  if (typeof sampleClass !== 'string') return null;
  const code = sampleClass.trim().toUpperCase();
  const canonicalCode = SAMPLE_CLASS_ALIASES[code] || code;
  const minutes = OFFICIAL_REACTION_MINUTES[canonicalCode];
  if (!minutes) return null;
  return `Read/scan after ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
