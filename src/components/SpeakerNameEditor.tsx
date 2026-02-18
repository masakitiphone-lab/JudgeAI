import { SpeakerNames } from "@/lib/types";

type Locale = "ja" | "en";

type SpeakerNameEditorProps = {
  speakerNames: SpeakerNames;
  onChange: (speaker: 0 | 1, value: string) => void;
  locale?: Locale;
};

export function SpeakerNameEditor({
  speakerNames,
  onChange,
  locale = "ja",
}: SpeakerNameEditorProps) {
  const isJa = locale === "ja";
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <label className="rounded-xl border border-blue-400/40 bg-blue-500/10 px-3 py-2">
        <span className="text-xs text-blue-200">
          {isJa ? "話者A名" : "Speaker A name"}
        </span>
        <input
          value={speakerNames[0]}
          onChange={(event) => onChange(0, event.target.value)}
          className="mt-1 w-full bg-transparent text-sm text-white outline-none"
          maxLength={20}
        />
      </label>
      <label className="rounded-xl border border-pink-400/40 bg-pink-500/10 px-3 py-2">
        <span className="text-xs text-pink-200">
          {isJa ? "話者B名" : "Speaker B name"}
        </span>
        <input
          value={speakerNames[1]}
          onChange={(event) => onChange(1, event.target.value)}
          className="mt-1 w-full bg-transparent text-sm text-white outline-none"
          maxLength={20}
        />
      </label>
    </div>
  );
}
