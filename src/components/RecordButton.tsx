type Locale = "ja" | "en";

type RecordButtonProps = {
  isRecording: boolean;
  disabled?: boolean;
  onClick: () => void;
  locale?: Locale;
};

export function RecordButton({
  isRecording,
  disabled = false,
  onClick,
  locale = "ja",
}: RecordButtonProps) {
  const isJa = locale === "ja";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
        isRecording
          ? "bg-red-500 text-white hover:bg-red-400"
          : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {isRecording
        ? isJa
          ? "録音OFF"
          : "Stop"
        : isJa
          ? "録音ON"
          : "Record"}
    </button>
  );
}
