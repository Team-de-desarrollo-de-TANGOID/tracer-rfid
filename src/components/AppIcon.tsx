interface Props {
  size?: number;
  className?: string;
  title?: string;
}

/** Icono de la aplicación (public/icon.ico). */
export default function AppIcon({
  size = 36,
  className = '',
  title = 'RFID TRACER',
}: Props) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icon.ico`}
      alt={title}
      title={title}
      width={size}
      height={size}
      draggable={false}
      className={`flex-shrink-0 object-contain ${className}`}
    />
  );
}
