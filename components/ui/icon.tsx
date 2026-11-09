const paths = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  map: 'm9 3 6 3 6-3v15l-6 3-6-3-6 3V6z M9 3v15 M15 6v15',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M7 3v4 M17 3v4 M3 11h18 M7 15h3 M14 15h3',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2 M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  arrow: 'M4 12h16 m-6-6 6 6-6 6',
  pin: 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  check: 'm5 12 4 4L19 6',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z m-4 9 3 3 5-6',
  close: 'm6 6 12 12 M6 18 18 6',
  play: 'm8 4 12 8-12 8z',
} as const;
export function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
export function PodMark() {
  return <svg width="34" height="34" viewBox="0 0 34 34" fill="currentColor" aria-hidden="true"><circle cx="10" cy="10" r="5"/><circle cx="24" cy="10" r="5"/><circle cx="10" cy="24" r="5"/><circle cx="24" cy="24" r="5"/><circle cx="17" cy="17" r="3" opacity=".5"/></svg>;
}
