// Wraps a photo container with thin corner brackets, evoking
// architectural crop marks / a viewfinder — used everywhere a room
// photo appears, to tie back to "this is a measured structural edit."
export default function CornerFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const corner =
    "absolute h-4 w-4 border-brass/70 pointer-events-none";
  return (
    <div className={`relative ${className}`}>
      {children}
      <span className={`${corner} -left-1 -top-1 border-l-2 border-t-2`} />
      <span className={`${corner} -right-1 -top-1 border-r-2 border-t-2`} />
      <span className={`${corner} -bottom-1 -left-1 border-b-2 border-l-2`} />
      <span className={`${corner} -bottom-1 -right-1 border-b-2 border-r-2`} />
    </div>
  );
}
