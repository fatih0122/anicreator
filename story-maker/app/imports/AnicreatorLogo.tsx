export default function AnicreatorLogo({ className = "size-full" }: { className?: string }) {
  return (
    <img
      src="/anicreator.svg"
      alt="Anicreator"
      className={className}
    />
  );
}
