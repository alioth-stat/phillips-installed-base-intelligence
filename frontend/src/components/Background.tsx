// Static decorative background. No motion: a slow-looping full-viewport
// animation would violate prefers-reduced-motion guidance for content that's
// visible the entire session.
export function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-slate-50">
      <div className="absolute -top-32 -left-24 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-sky-200 to-blue-400 opacity-40 blur-3xl" />
      <div className="absolute top-1/3 -right-40 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-blue-100 to-sky-300 opacity-40 blur-3xl" />
      <div className="absolute -bottom-40 left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-sky-100 to-blue-200 opacity-30 blur-3xl" />
    </div>
  )
}
