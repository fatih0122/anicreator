export default function UnicornLogo({ className = "", size = 60 }: { className?: string; size?: number }) {
  return (
    <img
      src="/unicorn.svg"
      alt="Anicreator Logo"
      width={size}
      height={size}
      style={{ maxWidth: size, maxHeight: size, width: size, height: 'auto' }}
      className={`object-contain ${className}`}
    />
  );
}
