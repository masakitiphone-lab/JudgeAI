type RecordButtonProps = {
  isRecording: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function RecordButton({
  isRecording,
  disabled = false,
  onClick,
}: RecordButtonProps) {
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
      {isRecording ? "録音OFF" : "録音ON"}
    </button>
  );
}
