export default function UnicornOnly({ className = "", size = 60 }: { className?: string; size?: number }) {
  return (
    <img
      src="/unicornonly.svg"
      alt="Anicreator"
      width={size}
      height={size}
      style={{ maxWidth: size, maxHeight: size, width: size, height: 'auto' }}
      className={`object-contain ${className}`}
    />
  );
}
