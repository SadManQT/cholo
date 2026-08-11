// doc 08-09-10 §10.2 worked example shows the driver's accept response as
// "Nusrat J." — first name plus last-initial, not the full legal name.
export function formatShortName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];

  const [first] = parts;
  const lastInitial = parts[parts.length - 1][0];

  return `${first} ${lastInitial}.`;
}
