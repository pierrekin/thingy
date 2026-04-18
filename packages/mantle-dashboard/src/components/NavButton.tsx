type Props = {
  onClick: () => void;
  children: React.ReactNode;
};

export function NavButton({ onClick, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-[0.75em] py-[0.375em] text-sm font-medium bg-surface hover:bg-warm-grey/20 rounded-md text-mist"
    >
      {children}
    </button>
  );
}
