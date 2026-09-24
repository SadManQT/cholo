// Calendar dates in Bangladesh time. The server itself runs in UTC on Render.
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' });

/** YYYY-MM-DD in Asia/Dhaka, optionally shifted by whole days. */
export function dhakaDate(offsetDays = 0) {
  return formatter.format(new Date(Date.now() + offsetDays * 86_400_000));
}
