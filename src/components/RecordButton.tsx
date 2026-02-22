type Locale = "ja" | "en";

type RecordButtonProps = {
  isRecording: boolean;
  audioLevel?: number;
  disabled?: boolean;
  onClick: () => void;
  locale?: Locale;
};

export function RecordButton({
  isRecording,
  audioLevel = 0,
  disabled = false,
  onClick,
  locale = "ja",
}: RecordButtonProps) {
  const isJa = locale === "ja";
  return (
    <div className="flex items-center gap-3">
      {/* Audio level visualization */}
      {isRecording && (
        <div className="flex items-center gap-1 h-8">
          {[...Array(10)].map((_, i) => {
            const threshold = (i + 1) * 10;
            const isActive = audioLevel >= threshold;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-75 ${
                  isActive 
                    ? "bg-emerald-400" 
                    : "bg-zinc-600"
                }`}
                style={{
                  height: `${8 + i * 2}px`,
                }}
              />
            );
          })}
        </div>
      )}
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
    </div>
  );
}
