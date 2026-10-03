// Fondo animado del kiosco: azul noche con manchas de color que se desplazan.
export default function AuroraBackground({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden bg-[#07051a] ${className}`} aria-hidden="true">
      <div className="kiosk-aurora-blob a" />
      <div className="kiosk-aurora-blob b" />
      <div className="kiosk-aurora-blob c" />
      <div className="kiosk-aurora-blob d" />
      {/* viñeta para que el texto se lea */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(7,5,26,0.75))]" />
    </div>
  );
}
