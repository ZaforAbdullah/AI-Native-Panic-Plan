import { ImageResponse } from "next/og";

export const alt = "PanicPlan — AI Study Companion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0d0f1a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            color: "#5b8eff",
            fontSize: 96,
            fontWeight: "bold",
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1,
          }}
        >
          PanicPlan
        </div>
        <div
          style={{
            color: "#ffffff",
            fontSize: 32,
            fontFamily: "system-ui, sans-serif",
            opacity: 0.8,
          }}
        >
          From panic to a plan
        </div>
      </div>
    ),
    size
  );
}
