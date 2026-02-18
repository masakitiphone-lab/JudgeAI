export interface Word {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word: string;
  speaker: number;
}

export interface Utterance {
  id: string;
  transcript: string;
  speaker: number;
  speaker_label: string;
  start: number;
  end: number;
  confidence: number;
  words: Word[];
  timestamp: string;
}

export interface SpeakerNames {
  0: string;
  1: string;
}

export interface JudgmentResult {
  summary: string;
  speaker_0_position: string;
  speaker_1_position: string;
  analysis: {
    speaker_0_valid_points: string[];
    speaker_0_issues: string[];
    speaker_1_valid_points: string[];
    speaker_1_issues: string[];
  };
  judgment: {
    verdict: string;
    confidence: number;
    reasoning: string;
  };
  advice: {
    to_speaker_0: string;
    to_speaker_1: string;
    general: string;
  };
}

export interface Judgment {
  id: string;
  timestamp: string;
  input_utterance_count: number;
  result: JudgmentResult;
}

export interface Session {
  id: string;
  created_at: string;
  utterances: Utterance[];
  judgments: Judgment[];
  is_recording: boolean;
  speaker_names: SpeakerNames;
}

export interface DeepgramWord {
  word?: string;
  start?: number;
  end?: number;
  confidence?: number;
  punctuated_word?: string;
  speaker?: number;
}

export interface DeepgramResultsMessage {
  type: "Results";
  is_final?: boolean;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
      confidence?: number;
      words?: DeepgramWord[];
    }>;
  };
}
