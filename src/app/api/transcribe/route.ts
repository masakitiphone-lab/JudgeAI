import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio") as File | null;

    if (!audio) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      return NextResponse.json(
        { error: "Deepgram API key not configured" },
        { status: 500 }
      );
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Send to Deepgram API
    const response = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&language=multi&punctuate=true&smart_format=true&diarize=true", {
      method: "POST",
      headers: {
        "Authorization": `Token ${deepgramApiKey}`,
        "Content-Type": audio.type || "audio/webm",
      },
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Deepgram API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Deepgram API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract transcript and words
    const channel = data?.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];
    const transcript = alternative?.transcript || "";
    const words = alternative?.words || [];

    return NextResponse.json({
      transcript,
      words,
      confidence: alternative?.confidence,
      duration: data?.results?.channels?.[0]?.alternatives?.[0]?.words?.[words.length - 1]?.end || 0,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
