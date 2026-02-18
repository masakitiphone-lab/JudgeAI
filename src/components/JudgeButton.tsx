type JudgeButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
};

export function JudgeButton({
  onClick,
  disabled = false,
  isLoading = false,
}: JudgeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? "ジャッジ中..." : "ジャッジして"}
    </button>
  );
}
