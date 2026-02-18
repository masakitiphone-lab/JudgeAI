import { SpeakerNames } from "@/lib/types";

export const DEFAULT_SPEAKER_NAMES: SpeakerNames = {
  0: "話者A",
  1: "話者B",
};

export const SESSION_STORAGE_KEY = "kenka_session_token";
export const SESSION_STATE_STORAGE_KEY = "kenka_session_state_v1";

export const DEEPGRAM_WS_BASE_URL = "wss://api.deepgram.com/v1/listen";

export const DEEPGRAM_QUERY_PARAMS_PRIMARY: Record<string, string> = {
  model: "nova-3",
  language: "ja",
  diarize: "true",
  punctuate: "true",
  smart_format: "true",
  interim_results: "true",
  endpointing: "300",
  utterance_end_ms: "1000",
  encoding: "linear16",
  sample_rate: "16000",
  channels: "1",
};

export const DEEPGRAM_QUERY_PARAMS_SAFE: Record<string, string> = {
  model: "nova-3",
  language: "ja",
  interim_results: "true",
  punctuate: "true",
  encoding: "linear16",
  sample_rate: "16000",
  channels: "1",
};

export const SYSTEM_PROMPT = `あなたは「喧嘩仲裁AI」です。2人の話者の会話ログを分析し、フェアで客観的なジャッジを行ってください。

以下のJSON形式で必ず回答してください:
{
  "summary": "喧嘩の要約（2-3文）",
  "speaker_0_position": "話者Aの主張の要約",
  "speaker_1_position": "話者Bの主張の要約",
  "analysis": {
    "speaker_0_valid_points": ["話者Aの正当な主張のリスト"],
    "speaker_0_issues": ["話者Aの問題点のリスト"],
    "speaker_1_valid_points": ["話者Bの正当な主張のリスト"],
    "speaker_1_issues": ["話者Bの問題点のリスト"]
  },
  "judgment": {
    "verdict": "話者Aが正しい / 話者Bが正しい / 引き分け / どちらも間違い",
    "confidence": 0.0,
    "reasoning": "判定の根拠（具体的な発言を引用）"
  },
  "advice": {
    "to_speaker_0": "話者Aへのアドバイス",
    "to_speaker_1": "話者Bへのアドバイス",
    "general": "2人へのアドバイス"
  }
}

ルール:
- 中立であること。どちらかに肩入れしない
- 論理的整合性、事実関係、感情的暴言の有無を評価する
- 暴言や人格否定があった場合は明確に指摘する
- 会話の文脈を踏まえてジャッジする
- 日本語で回答する`;
