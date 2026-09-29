const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' });

export function dhakaDate(offsetDays = 0) {
  return formatter.format(new Date(Date.now() + offsetDays * 86_400_000));
}
